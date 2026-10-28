"""Zones (with the derived active-incident count of fn_active_incidents) and shelters."""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import RuleError
from ..models import User
from ..schemas import ShelterIn, ShelterUpdateIn, ZoneIn, ZoneUpdateIn
from ..security import require_roles
from ..sqlutil import must, one, rows, run, scalar

router = APIRouter(prefix="/api", tags=["zones & shelters"])
admin = require_roles("ADMINISTRATOR")
managers = require_roles("COORDINATOR", "ADMINISTRATOR")

# Same figures as the v_zone_situation view of 05_queries.sql, computed inline so the API
# does not depend on that view having been created.
ZONE_SQL = """
SELECT z.id, z.zone_name, z.district, z.state, z.risk_level,
       g.latitude, g.longitude, g.radius_km,
       fn_active_incidents(z.id) AS active_incidents,
       (SELECT count(*) FROM response_units r WHERE r.zone_id = z.id AND r.availability_status = 'AVAILABLE') AS units_available,
       (SELECT count(*) FROM response_units r WHERE r.zone_id = z.id) AS units_total,
       (SELECT count(*) FROM incidents i WHERE i.zone_id = z.id) AS incidents_total,
       (SELECT count(*) FROM app_shelters s WHERE s.zone_id = z.id AND s.status = 'OPEN') AS shelters_open
FROM zones z LEFT JOIN app_zone_geo g ON g.zone_id = z.id
"""


@router.get("/zones")
def list_zones(db: Session = Depends(get_db)):
    """Public: zone names, risk and situation counts (no personal data)."""
    return rows(db, ZONE_SQL + " ORDER BY z.id")


@router.get("/zones/{zone_id}")
def get_zone(zone_id: int, db: Session = Depends(get_db)):
    return must(one(db, ZONE_SQL + " WHERE z.id = :id", id=zone_id), "Zone")


def _save_geo(db: Session, zone_id: int, lat, lng, radius):
    if lat is None and lng is None and radius is None:
        return
    cur = one(db, "SELECT latitude, longitude, radius_km FROM app_zone_geo WHERE zone_id = :z", z=zone_id)
    if cur is None and (lat is None or lng is None):
        raise RuleError("Latitude and longitude are both needed to place a zone on the map", 422)
    if cur is None:
        run(db, "INSERT INTO app_zone_geo (zone_id, latitude, longitude, radius_km) VALUES (:z, :a, :o, coalesce(:r, 3))",
            z=zone_id, a=lat, o=lng, r=radius)
    else:
        run(db, """UPDATE app_zone_geo SET latitude = coalesce(:a, latitude), longitude = coalesce(:o, longitude),
                   radius_km = coalesce(:r, radius_km) WHERE zone_id = :z""", z=zone_id, a=lat, o=lng, r=radius)


@router.post("/zones", status_code=201)
def create_zone(body: ZoneIn, _: User = Depends(admin), db: Session = Depends(get_db)):
    new_id = scalar(db, """INSERT INTO zones (zone_name, district, state, risk_level)
                           VALUES (:n, :d, :s, :r) RETURNING id""",
                    n=body.zone_name, d=body.district, s=body.state, r=body.risk_level)
    _save_geo(db, new_id, body.latitude, body.longitude, body.radius_km)
    db.commit()
    return get_zone(new_id, db)


@router.patch("/zones/{zone_id}")
def update_zone(zone_id: int, body: ZoneUpdateIn, _: User = Depends(admin), db: Session = Depends(get_db)):
    must(one(db, "SELECT id FROM zones WHERE id = :id", id=zone_id), "Zone")
    data = body.model_dump(exclude_unset=True, exclude={"latitude", "longitude", "radius_km"})
    if data:
        run(db, f"UPDATE zones SET {', '.join(f'{k} = :{k}' for k in data)} WHERE id = :id", **data, id=zone_id)
    _save_geo(db, zone_id, body.latitude, body.longitude, body.radius_km)
    db.commit()
    return get_zone(zone_id, db)


# ======================================================================== shelters
SHELTER_SQL = """
SELECT s.id, s.shelter_name, s.shelter_type, s.facility_type, s.zone_id, z.zone_name, z.district, z.risk_level,
       s.address, s.capacity, s.current_occupancy, (s.capacity - s.current_occupancy) AS available,
       s.status, s.open_24x7, s.contact_phone, s.amenities, s.latitude, s.longitude, s.updated_at
FROM app_shelters s JOIN zones z ON z.id = s.zone_id
"""


@router.get("/shelters")
def list_shelters(zone_id: Optional[int] = None, shelter_type: Optional[str] = None, status: Optional[str] = None,
                  available_only: bool = False, q: Optional[str] = None, db: Session = Depends(get_db)):
    """Public list of shelters and safe zones."""
    where, p = ["true"], {}
    if zone_id:
        where.append("s.zone_id = :z"); p["z"] = zone_id
    if shelter_type:
        where.append("s.shelter_type = :t"); p["t"] = shelter_type.upper()
    if status:
        where.append("s.status = :s"); p["s"] = status.upper()
    if available_only:
        where.append("s.status = 'OPEN' AND s.current_occupancy < s.capacity")
    if q:
        where.append("(s.shelter_name ILIKE :q OR s.address ILIKE :q OR z.zone_name ILIKE :q OR z.district ILIKE :q)")
        p["q"] = f"%{q}%"
    return rows(db, SHELTER_SQL + " WHERE " + " AND ".join(where) + " ORDER BY s.status = 'OPEN' DESC, s.id", **p)


@router.post("/shelters", status_code=201)
def create_shelter(body: ShelterIn, _: User = Depends(managers), db: Session = Depends(get_db)):
    data = body.model_dump()
    if data["current_occupancy"] >= data["capacity"] and data["status"] == "OPEN":
        data["status"] = "FULL"
    new_id = scalar(db, f"""INSERT INTO app_shelters ({', '.join(data)}) VALUES ({', '.join(':' + k for k in data)})
                            RETURNING id""", **data)
    db.commit()
    return one(db, SHELTER_SQL + " WHERE s.id = :id", id=new_id)


@router.patch("/shelters/{shelter_id}")
def update_shelter(shelter_id: int, body: ShelterUpdateIn, _: User = Depends(managers), db: Session = Depends(get_db)):
    cur = must(one(db, "SELECT * FROM app_shelters WHERE id = :id", id=shelter_id), "Shelter")
    data = body.model_dump(exclude_unset=True)
    occ = data.get("current_occupancy", cur["current_occupancy"])
    cap = data.get("capacity", cur["capacity"])
    status = data.get("status", cur["status"])
    if status != "CLOSED" and "status" not in data:
        data["status"] = "FULL" if occ >= cap else "OPEN"
    if data:
        run(db, f"UPDATE app_shelters SET {', '.join(f'{k} = :{k}' for k in data)}, updated_at = now() WHERE id = :id",
            **data, id=shelter_id)
        db.commit()
    return one(db, SHELTER_SQL + " WHERE s.id = :id", id=shelter_id)
