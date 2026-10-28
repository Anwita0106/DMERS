"""Response units, dispatches (FR-07/FR-08), relief resources (FR-09) and allocations (FR-10).

* New dispatches go through CALL sp_dispatch_unit(...): the procedure checks that the
  official is a COORDINATOR, trigger T3 checks BR-05, and the incident moves to RESPONDING.
* Allocations are INSERT/UPDATE/DELETE on resource_allocations; trigger T4 moves the stock
  and writes the timeline note, and refuses an allocation larger than the stock.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db, set_actor
from ..errors import RuleError
from ..models import User
from ..schemas import (AllocationIn, AllocationUpdateIn, DispatchIn, DispatchStatusIn, ResourceIn,
                       ResourceUpdateIn, UnitIn, UnitUpdateIn)
from ..security import require_roles, require_staff
from ..sqlutil import must, one, rows, run, scalar

router = APIRouter(prefix="/api", tags=["operations"])
managers = require_roles("COORDINATOR", "ADMINISTRATOR")
admin = require_roles("ADMINISTRATOR")

# ================================================================== response units
UNIT_SQL = """
SELECT r.id, r.unit_name, r.unit_type, r.contact_phone, r.personnel_count, r.availability_status,
       r.zone_id, z.zone_name, r.lead_user_id, u.full_name AS lead_name,
       g.latitude AS zone_lat, g.longitude AS zone_lng,
       d.incident_id AS current_incident_id, i.title AS current_incident_title,
       d.dispatch_status AS current_dispatch_status, d.dispatched_at AS current_dispatched_at,
       (SELECT count(*) FROM dispatches x WHERE x.unit_id = r.id) AS total_dispatches,
       (SELECT count(*) FROM dispatches x WHERE x.unit_id = r.id AND x.dispatch_status = 'COMPLETED') AS completed_dispatches
FROM response_units r
JOIN zones z ON z.id = r.zone_id
LEFT JOIN users u ON u.id = r.lead_user_id
LEFT JOIN app_zone_geo g ON g.zone_id = r.zone_id
LEFT JOIN dispatches d ON d.unit_id = r.id AND d.dispatch_status IN ('ASSIGNED', 'EN_ROUTE', 'ON_SCENE')
LEFT JOIN incidents i ON i.id = d.incident_id
"""


@router.get("/units")
def list_units(availability: Optional[str] = None, unit_type: Optional[str] = None, zone_id: Optional[int] = None,
               q: Optional[str] = None, _: User = Depends(require_staff), db: Session = Depends(get_db)):
    where, p = ["true"], {}
    if availability:
        where.append("r.availability_status = :a"); p["a"] = availability.upper()
    if unit_type:
        where.append("r.unit_type = :t"); p["t"] = unit_type.upper()
    if zone_id:
        where.append("r.zone_id = :z"); p["z"] = zone_id
    if q:
        where.append("(r.unit_name ILIKE :q OR z.zone_name ILIKE :q)"); p["q"] = f"%{q}%"
    return rows(db, UNIT_SQL + " WHERE " + " AND ".join(where) + " ORDER BY r.id", **p)


def _check_lead(db: Session, lead_id: Optional[int]):
    if lead_id is None:
        return
    lead = must(one(db, "SELECT account_type FROM users WHERE id = :id", id=lead_id), "User")
    if lead["account_type"] != "UNIT_LEAD":
        raise RuleError("A unit's lead must have the UNIT_LEAD account type", 422)


@router.post("/units", status_code=201)
def create_unit(body: UnitIn, _: User = Depends(admin), db: Session = Depends(get_db)):
    _check_lead(db, body.lead_user_id)
    new_id = scalar(db, """INSERT INTO response_units (unit_name, unit_type, contact_phone, personnel_count,
                           zone_id, lead_user_id) VALUES (:unit_name, :unit_type, :contact_phone, :personnel_count,
                           :zone_id, :lead_user_id) RETURNING id""", **body.model_dump())
    db.commit()
    return one(db, UNIT_SQL + " WHERE r.id = :id", id=new_id)


@router.patch("/units/{unit_id}")
def update_unit(unit_id: int, body: UnitUpdateIn, user: User = Depends(managers), db: Session = Depends(get_db)):
    unit = must(one(db, UNIT_SQL + " WHERE r.id = :id", id=unit_id), "Response unit")
    data = body.model_dump(exclude_unset=True, exclude={"clear_lead", "availability_status"})
    if data and user.account_type != "ADMINISTRATOR":
        raise RuleError("Only an administrator can change a unit's details", 403)
    if body.clear_lead:
        if user.account_type != "ADMINISTRATOR":
            raise RuleError("Only an administrator can change a unit's lead", 403)
        data["lead_user_id"] = None
    elif "lead_user_id" in data:
        _check_lead(db, data["lead_user_id"])
    if body.availability_status:
        # DEPLOYED is set and cleared only by dispatches (sp_dispatch_unit / dispatch completion)
        if unit["current_incident_id"]:
            raise RuleError("This unit has an active dispatch; complete or cancel it first")
        data["availability_status"] = body.availability_status
    if data:
        run(db, f"UPDATE response_units SET {', '.join(f'{k} = :{k}' for k in data)} WHERE id = :id",
            **data, id=unit_id)
        db.commit()
    return one(db, UNIT_SQL + " WHERE r.id = :id", id=unit_id)


# ====================================================================== dispatches
DISPATCH_SQL = """
SELECT d.incident_id, i.title AS incident_title, i.severity AS incident_severity, i.status AS incident_status,
       z.zone_name, d.unit_id, r.unit_name, r.unit_type, r.contact_phone, d.dispatch_status,
       d.dispatched_by, u.full_name AS dispatched_by_name, d.dispatched_at, d.arrived_at, d.cleared_at,
       round(extract(epoch FROM d.arrived_at - d.dispatched_at) / 60, 1) AS travel_minutes,
       r.lead_user_id
FROM dispatches d
JOIN incidents i ON i.id = d.incident_id
LEFT JOIN zones z ON z.id = i.zone_id
JOIN response_units r ON r.id = d.unit_id
JOIN users u ON u.id = d.dispatched_by
"""
DISPATCH_FLOW = {
    "ASSIGNED": {"EN_ROUTE", "ON_SCENE", "CANCELLED"},
    "EN_ROUTE": {"ON_SCENE", "CANCELLED"},
    "ON_SCENE": {"COMPLETED"},
}


@router.get("/dispatches")
def list_dispatches(status: Optional[str] = None, active_only: bool = False, incident_id: Optional[int] = None,
                    unit_id: Optional[int] = None, _: User = Depends(require_staff), db: Session = Depends(get_db)):
    where, p = ["true"], {}
    if status:
        where.append("d.dispatch_status = ANY(:s)"); p["s"] = [s.strip().upper() for s in status.split(",")]
    if active_only:
        where.append("d.dispatch_status IN ('ASSIGNED', 'EN_ROUTE', 'ON_SCENE')")
    if incident_id:
        where.append("d.incident_id = :i"); p["i"] = incident_id
    if unit_id:
        where.append("d.unit_id = :u"); p["u"] = unit_id
    return rows(db, DISPATCH_SQL + " WHERE " + " AND ".join(where) + " ORDER BY d.dispatched_at DESC", **p)


@router.post("/dispatches", status_code=201)
def dispatch_unit(body: DispatchIn, user: User = Depends(require_staff), db: Session = Depends(get_db)):
    """CALL sp_dispatch_unit(incident, unit, user). Only COORDINATOR accounts pass (FR-07)."""
    run(db, "CALL sp_dispatch_unit(:i, :u, :c)", i=body.incident_id, u=body.unit_id, c=user.id)
    db.commit()
    return one(db, DISPATCH_SQL + " WHERE d.incident_id = :i AND d.unit_id = :u", i=body.incident_id, u=body.unit_id)


@router.patch("/dispatches/{incident_id}/{unit_id}")
def update_dispatch(incident_id: int, unit_id: int, body: DispatchStatusIn,
                    user: User = Depends(require_staff), db: Session = Depends(get_db)):
    """Progress a dispatch: EN_ROUTE, ON_SCENE (records arrived_at), COMPLETED / CANCELLED
    (records cleared_at and makes the unit AVAILABLE again), as in 03_seed_data.sql."""
    d = must(one(db, DISPATCH_SQL + " WHERE d.incident_id = :i AND d.unit_id = :u", i=incident_id, u=unit_id), "Dispatch")
    if user.account_type == "UNIT_LEAD" and d["lead_user_id"] != user.id:
        raise RuleError("Unit leads can only update dispatches of the unit they lead", 403)
    new = body.dispatch_status
    if new not in DISPATCH_FLOW.get(d["dispatch_status"], set()):
        raise RuleError(f"A dispatch cannot go from {d['dispatch_status']} to {new}")
    set_actor(db, user.id)
    if new == "EN_ROUTE":
        run(db, "UPDATE dispatches SET dispatch_status = 'EN_ROUTE' WHERE incident_id = :i AND unit_id = :u",
            i=incident_id, u=unit_id)
    elif new == "ON_SCENE":
        run(db, """UPDATE dispatches SET dispatch_status = 'ON_SCENE', arrived_at = greatest(now(), dispatched_at)
                   WHERE incident_id = :i AND unit_id = :u""", i=incident_id, u=unit_id)
    else:
        run(db, """UPDATE dispatches SET dispatch_status = :s,
                       cleared_at = greatest(now(), coalesce(arrived_at, dispatched_at))
                   WHERE incident_id = :i AND unit_id = :u""", s=new, i=incident_id, u=unit_id)
        run(db, "UPDATE response_units SET availability_status = 'AVAILABLE' WHERE id = :u", u=unit_id)
    db.commit()
    return one(db, DISPATCH_SQL + " WHERE d.incident_id = :i AND d.unit_id = :u", i=incident_id, u=unit_id)


# ======================================================================= resources
RESOURCE_SQL = """
SELECT r.id, r.resource_name, r.category, r.unit_of_measure, r.quantity_available, r.reorder_level,
       fn_stock_status(r.id) AS stock_status,
       coalesce((SELECT sum(quantity) FROM resource_allocations a WHERE a.resource_id = r.id), 0) AS quantity_allocated,
       (SELECT count(*) FROM resource_allocations a WHERE a.resource_id = r.id) AS incidents_supplied
FROM resources r
"""


@router.get("/resources")
def list_resources(category: Optional[str] = None, stock_status: Optional[str] = None, q: Optional[str] = None,
                   _: User = Depends(require_staff), db: Session = Depends(get_db)):
    where, p = ["true"], {}
    if category:
        where.append("r.category = :c"); p["c"] = category.upper()
    if stock_status:
        where.append("fn_stock_status(r.id) = :ss"); p["ss"] = stock_status.upper()
    if q:
        where.append("r.resource_name ILIKE :q"); p["q"] = f"%{q}%"
    return rows(db, RESOURCE_SQL + " WHERE " + " AND ".join(where) + " ORDER BY r.id", **p)


@router.post("/resources", status_code=201)
def create_resource(body: ResourceIn, _: User = Depends(admin), db: Session = Depends(get_db)):
    new_id = scalar(db, """INSERT INTO resources (resource_name, category, unit_of_measure, quantity_available,
                           reorder_level) VALUES (:resource_name, :category, :unit_of_measure, :quantity_available,
                           :reorder_level) RETURNING id""", **body.model_dump())
    db.commit()
    return one(db, RESOURCE_SQL + " WHERE r.id = :id", id=new_id)


@router.patch("/resources/{resource_id}")
def update_resource(resource_id: int, body: ResourceUpdateIn, _: User = Depends(admin), db: Session = Depends(get_db)):
    """Administrator edits or restocks a resource (04_dml_demo.sql D4)."""
    must(one(db, "SELECT id FROM resources WHERE id = :id", id=resource_id), "Resource")
    data = body.model_dump(exclude_unset=True, exclude={"restock", "quantity_available"})
    sets = [f"{k} = :{k}" for k in data]
    if body.restock is not None:
        sets.append("quantity_available = quantity_available + :restock"); data["restock"] = body.restock
    elif body.quantity_available is not None:
        sets.append("quantity_available = :qa"); data["qa"] = body.quantity_available
    if sets:
        run(db, f"UPDATE resources SET {', '.join(sets)} WHERE id = :id", **data, id=resource_id)
        db.commit()
    return one(db, RESOURCE_SQL + " WHERE r.id = :id", id=resource_id)


# ===================================================================== allocations
ALLOC_SQL = """
SELECT a.incident_id, i.title AS incident_title, i.status AS incident_status, z.zone_name,
       a.resource_id, r.resource_name, r.category, r.unit_of_measure, a.quantity, a.allocated_at,
       r.quantity_available AS stock_left, fn_stock_status(r.id) AS stock_status
FROM resource_allocations a
JOIN incidents i ON i.id = a.incident_id
LEFT JOIN zones z ON z.id = i.zone_id
JOIN resources r ON r.id = a.resource_id
"""


@router.get("/allocations")
def list_allocations(incident_id: Optional[int] = None, resource_id: Optional[int] = None,
                     category: Optional[str] = None, _: User = Depends(require_staff), db: Session = Depends(get_db)):
    where, p = ["true"], {}
    if incident_id:
        where.append("a.incident_id = :i"); p["i"] = incident_id
    if resource_id:
        where.append("a.resource_id = :r"); p["r"] = resource_id
    if category:
        where.append("r.category = :c"); p["c"] = category.upper()
    return rows(db, ALLOC_SQL + " WHERE " + " AND ".join(where) + " ORDER BY a.allocated_at DESC", **p)


def _open_incident(db: Session, incident_id: int) -> dict:
    inc = must(one(db, "SELECT id, status FROM incidents WHERE id = :i", i=incident_id), "Incident")
    if inc["status"] not in ("VERIFIED", "RESPONDING"):
        raise RuleError(f"Relief can be allocated only to VERIFIED or RESPONDING incidents (this one is {inc['status']})")
    return inc


@router.post("/allocations", status_code=201)
def allocate(body: AllocationIn, user: User = Depends(managers), db: Session = Depends(get_db)):
    """Adds to the incident's allocation of this item (cumulative, as in 03_seed_data.sql)."""
    _open_incident(db, body.incident_id)
    must(one(db, "SELECT id FROM resources WHERE id = :r", r=body.resource_id), "Resource")
    set_actor(db, user.id)
    run(db, """INSERT INTO resource_allocations AS ra (incident_id, resource_id, quantity)
               VALUES (:i, :r, :q)
               ON CONFLICT (incident_id, resource_id)
               DO UPDATE SET quantity = ra.quantity + EXCLUDED.quantity, allocated_at = now()""",
        i=body.incident_id, r=body.resource_id, q=body.quantity)
    db.commit()
    return one(db, ALLOC_SQL + " WHERE a.incident_id = :i AND a.resource_id = :r", i=body.incident_id, r=body.resource_id)


@router.patch("/allocations/{incident_id}/{resource_id}")
def set_allocation(incident_id: int, resource_id: int, body: AllocationUpdateIn,
                   user: User = Depends(managers), db: Session = Depends(get_db)):
    """Sets the allocated total; trigger T4 takes or returns only the difference."""
    _open_incident(db, incident_id)
    must(one(db, "SELECT 1 AS x FROM resource_allocations WHERE incident_id = :i AND resource_id = :r",
             i=incident_id, r=resource_id), "Allocation")
    set_actor(db, user.id)
    run(db, "UPDATE resource_allocations SET quantity = :q WHERE incident_id = :i AND resource_id = :r",
        q=body.quantity, i=incident_id, r=resource_id)
    db.commit()
    return one(db, ALLOC_SQL + " WHERE a.incident_id = :i AND a.resource_id = :r", i=incident_id, r=resource_id)


@router.delete("/allocations/{incident_id}/{resource_id}", status_code=204)
def withdraw_allocation(incident_id: int, resource_id: int, user: User = Depends(managers), db: Session = Depends(get_db)):
    """Withdraws an allocation; trigger T4 returns the stock and notes it on the timeline."""
    _open_incident(db, incident_id)
    must(one(db, "SELECT 1 AS x FROM resource_allocations WHERE incident_id = :i AND resource_id = :r",
             i=incident_id, r=resource_id), "Allocation")
    set_actor(db, user.id)
    run(db, "DELETE FROM resource_allocations WHERE incident_id = :i AND resource_id = :r", i=incident_id, r=resource_id)
    db.commit()
