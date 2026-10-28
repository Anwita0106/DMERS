"""Public summary, command-center dashboard, analytics and global search (read-only)."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..security import STAFF, get_optional_user, require_staff
from ..sqlutil import jitter, one, rows, scalar

router = APIRouter(prefix="/api", tags=["dashboard & analytics"])

ACTIVE = "('VERIFIED', 'RESPONDING')"          # same definition as fn_active_incidents
OPEN = "('REPORTED', 'VERIFIED', 'RESPONDING')"


def _alerts(db: Session, limit: int = 50) -> list[dict]:
    """Verified, active incidents for the public (no reporter details)."""
    out = rows(db, f"""
        SELECT i.id, i.title, i.incident_type, i.severity, i.status, i.location, i.zone_id, z.zone_name,
               z.district, i.created_at, i.updated_at, g.latitude AS zone_lat, g.longitude AS zone_lng,
               (SELECT count(*) FROM dispatches d WHERE d.incident_id = i.id
                  AND d.dispatch_status IN ('ASSIGNED', 'EN_ROUTE', 'ON_SCENE')) AS units_responding
        FROM incidents i JOIN zones z ON z.id = i.zone_id LEFT JOIN app_zone_geo g ON g.zone_id = i.zone_id
        WHERE i.status IN {ACTIVE}
        ORDER BY array_position(ARRAY['CRITICAL','HIGH','MODERATE','LOW']::varchar[], i.severity), i.updated_at DESC
        LIMIT :lim""", lim=limit)
    for r in out:
        r["latitude"], r["longitude"] = jitter(r.pop("zone_lat"), r.pop("zone_lng"), r["id"])
    return out


@router.get("/public/summary")
def public_summary(db: Session = Depends(get_db)):
    k = one(db, f"""
        SELECT (SELECT count(*) FROM incidents WHERE status IN {ACTIVE}) AS active_incidents,
               (SELECT count(*) FROM incidents WHERE status IN {ACTIVE} AND severity IN ('HIGH', 'CRITICAL')) AS critical_alerts,
               (SELECT count(*) FROM response_units WHERE availability_status = 'AVAILABLE') AS units_available,
               (SELECT count(*) FROM response_units) AS units_total,
               (SELECT count(*) FROM app_shelters WHERE status = 'OPEN') AS shelters_open,
               (SELECT coalesce(sum(capacity - current_occupancy), 0) FROM app_shelters WHERE status = 'OPEN') AS shelter_beds_free""")
    return {**k, "alerts": _alerts(db, 12)}


@router.get("/public/alerts")
def public_alerts(db: Session = Depends(get_db)):
    return _alerts(db)


@router.get("/dashboard/stats")
def dashboard(_: User = Depends(require_staff), db: Session = Depends(get_db)):
    kpi = one(db, f"""
        SELECT count(*) AS total_incidents,
               count(*) FILTER (WHERE status IN {ACTIVE}) AS active_incidents,
               count(*) FILTER (WHERE status = 'REPORTED') AS awaiting_verification,
               count(*) FILTER (WHERE status IN {OPEN} AND severity = 'CRITICAL') AS critical_incidents,
               count(*) FILTER (WHERE status IN {OPEN} AND severity = 'HIGH') AS high_incidents,
               count(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED')) AS resolved_incidents,
               count(*) FILTER (WHERE status = 'REJECTED') AS rejected_incidents,
               count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS new_last_7_days,
               count(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED') AND updated_at >= now() - interval '7 days') AS resolved_last_7_days,
               round(avg(fn_response_minutes(id)), 1) AS avg_response_minutes
        FROM incidents""")
    units = one(db, """
        SELECT count(*) AS total,
               count(*) FILTER (WHERE availability_status = 'AVAILABLE') AS available,
               count(*) FILTER (WHERE availability_status = 'DEPLOYED') AS deployed,
               count(*) FILTER (WHERE availability_status = 'OFF_DUTY') AS off_duty,
               coalesce(sum(personnel_count), 0) AS personnel
        FROM response_units""")
    units["active_dispatches"] = scalar(db, "SELECT count(*) FROM dispatches WHERE dispatch_status IN ('ASSIGNED','EN_ROUTE','ON_SCENE')")
    shelters = one(db, """SELECT count(*) FILTER (WHERE status = 'OPEN') AS open, count(*) AS total,
                                 coalesce(sum(capacity) FILTER (WHERE status <> 'CLOSED'), 0) AS capacity,
                                 coalesce(sum(current_occupancy) FILTER (WHERE status <> 'CLOSED'), 0) AS occupancy
                          FROM app_shelters""")
    low_stock = rows(db, """SELECT id, resource_name, category, unit_of_measure, quantity_available, reorder_level,
                                   fn_stock_status(id) AS stock_status
                            FROM resources WHERE fn_stock_status(id) <> 'ADEQUATE' ORDER BY quantity_available""")
    recent = rows(db, """
        SELECT i.id, i.title, i.incident_type, i.severity, i.status, i.location, z.zone_name, i.created_at, i.updated_at
        FROM incidents i LEFT JOIN zones z ON z.id = i.zone_id ORDER BY i.updated_at DESC LIMIT 8""")
    activity = rows(db, """
        SELECT t.incident_id, i.title, t.update_no, t.previous_status, t.new_status, t.note, t.logged_at,
               u.full_name AS logged_by_name
        FROM incident_updates t JOIN incidents i ON i.id = t.incident_id LEFT JOIN users u ON u.id = t.logged_by
        ORDER BY t.logged_at DESC, t.update_no DESC LIMIT 12""")
    map_incidents = rows(db, f"""
        SELECT i.id, i.title, i.incident_type, i.severity, i.status, z.zone_name,
               g.latitude AS zone_lat, g.longitude AS zone_lng
        FROM incidents i JOIN zones z ON z.id = i.zone_id JOIN app_zone_geo g ON g.zone_id = i.zone_id
        WHERE i.status IN {OPEN}""")
    for r in map_incidents:
        r["latitude"], r["longitude"] = jitter(r.pop("zone_lat"), r.pop("zone_lng"), r["id"])
    map_units = rows(db, """
        SELECT r.id, r.unit_name, r.unit_type, r.availability_status, z.zone_name,
               g.latitude AS zone_lat, g.longitude AS zone_lng
        FROM response_units r JOIN zones z ON z.id = r.zone_id JOIN app_zone_geo g ON g.zone_id = r.zone_id""")
    for r in map_units:
        r["latitude"], r["longitude"] = jitter(r.pop("zone_lat"), r.pop("zone_lng"), 1000 + r["id"], 0.012)
    map_shelters = rows(db, "SELECT id, shelter_name, status, capacity, current_occupancy, latitude, longitude FROM app_shelters")
    zones = rows(db, """
        SELECT z.id, z.zone_name, z.risk_level, fn_active_incidents(z.id) AS active_incidents,
               (SELECT count(*) FROM response_units r WHERE r.zone_id = z.id AND r.availability_status = 'AVAILABLE') AS units_available
        FROM zones z ORDER BY fn_active_incidents(z.id) DESC, z.risk_level = 'HIGH' DESC, z.zone_name""")
    return {"kpis": kpi, "units": units, "shelters": shelters, "low_stock": low_stock, "recent": recent,
            "activity": activity, "zones": zones,
            "map": {"incidents": map_incidents, "units": map_units, "shelters": map_shelters}}


@router.get("/analytics")
def analytics(days: int = Query(30, ge=0, le=3650, description="0 = all time"),
              _: User = Depends(require_staff), db: Session = Depends(get_db)):
    if days:
        start_sql, p = "date_trunc('day', now()) - make_interval(days => :d - 1)", {"d": days}
    else:
        start_sql, p = "coalesce(date_trunc('day', (SELECT min(created_at) FROM incidents)), date_trunc('day', now()))", {}
    since = f"i.created_at >= {start_sql}"
    totals = one(db, f"""
        SELECT count(*) AS total,
               count(*) FILTER (WHERE status IN {ACTIVE}) AS active,
               count(*) FILTER (WHERE severity = 'CRITICAL') AS critical,
               count(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED')) AS resolved,
               round(avg(fn_response_minutes(id)), 1) AS avg_response_minutes
        FROM incidents i WHERE {since}""", **p)
    daily = rows(db, f"""
        SELECT to_char(d, 'YYYY-MM-DD') AS day,
               (SELECT count(*) FROM incidents i WHERE date_trunc('day', i.created_at) = d) AS reported,
               (SELECT count(*) FROM incidents i WHERE i.status IN ('RESOLVED', 'CLOSED')
                  AND date_trunc('day', i.updated_at) = d) AS resolved
        FROM generate_series({start_sql}, date_trunc('day', now()), interval '1 day') AS d""", **p)
    by_type = rows(db, f"SELECT incident_type AS label, count(*) AS value FROM incidents i WHERE {since} GROUP BY 1 ORDER BY 2 DESC, 1", **p)
    by_severity = rows(db, f"""SELECT s AS label, (SELECT count(*) FROM incidents i WHERE i.severity = s AND {since}) AS value
                               FROM unnest(ARRAY['LOW','MODERATE','HIGH','CRITICAL']) AS s""", **p)
    by_status = rows(db, f"""SELECT s AS label, (SELECT count(*) FROM incidents i WHERE i.status = s AND {since}) AS value
                             FROM unnest(ARRAY['REPORTED','VERIFIED','RESPONDING','RESOLVED','CLOSED','REJECTED']) AS s""", **p)
    by_zone = rows(db, f"""
        SELECT z.zone_name AS label, z.risk_level,
               (SELECT count(*) FROM incidents i WHERE i.zone_id = z.id AND {since}) AS value,
               fn_active_incidents(z.id) AS active
        FROM zones z ORDER BY 3 DESC, z.zone_name""", **p)
    response_by_type = rows(db, f"""
        SELECT incident_type AS label, round(avg(fn_response_minutes(id)), 1) AS value, count(*) AS incidents
        FROM incidents i WHERE {since} AND fn_response_minutes(id) IS NOT NULL GROUP BY 1 ORDER BY 2""", **p)
    resources = rows(db, f"""
        SELECT r.category AS label,
               coalesce(sum(r.quantity_available), 0) AS available,
               coalesce((SELECT sum(a.quantity) FROM resource_allocations a JOIN resources x ON x.id = a.resource_id
                         WHERE x.category = r.category AND a.allocated_at >= {start_sql}), 0) AS allocated
        FROM resources r GROUP BY r.category ORDER BY r.category""", **p)
    units = rows(db, f"""
        SELECT r.unit_type AS label, count(*) AS units,
               count(*) FILTER (WHERE r.availability_status = 'AVAILABLE') AS available,
               count(*) FILTER (WHERE r.availability_status = 'DEPLOYED') AS deployed,
               (SELECT count(*) FROM dispatches d JOIN response_units x ON x.id = d.unit_id
                WHERE x.unit_type = r.unit_type AND d.dispatched_at >= {start_sql}) AS dispatches,
               (SELECT round(avg(extract(epoch FROM d.arrived_at - d.dispatched_at) / 60), 1)
                FROM dispatches d JOIN response_units x ON x.id = d.unit_id
                WHERE x.unit_type = r.unit_type AND d.arrived_at IS NOT NULL AND d.dispatched_at >= {start_sql}) AS avg_travel_minutes
        FROM response_units r GROUP BY r.unit_type ORDER BY r.unit_type""", **p)
    return {"days": days, "range_start": daily[0]["day"] if daily else None, "totals": totals, "daily": daily,
            "by_type": by_type, "by_severity": by_severity, "by_status": by_status, "by_zone": by_zone,
            "response_by_type": response_by_type, "resources": resources, "units": units}


@router.get("/search")
def search(q: str = Query(..., min_length=2, max_length=60), user: Optional[User] = Depends(get_optional_user),
           db: Session = Depends(get_db)):
    like = f"%{q}%"
    out = {
        "zones": rows(db, "SELECT id, zone_name, district, risk_level FROM zones WHERE zone_name ILIKE :q OR district ILIKE :q LIMIT 5", q=like),
        "shelters": rows(db, "SELECT id, shelter_name, status FROM app_shelters WHERE shelter_name ILIKE :q OR address ILIKE :q LIMIT 5", q=like),
    }
    if user and user.account_type in STAFF:
        out["incidents"] = rows(db, """SELECT id, title, status, severity FROM incidents
                                       WHERE title ILIKE :q OR location ILIKE :q OR id::text = :raw
                                       ORDER BY updated_at DESC LIMIT 6""", q=like, raw=q.strip())
        out["units"] = rows(db, "SELECT id, unit_name, unit_type, availability_status FROM response_units WHERE unit_name ILIKE :q LIMIT 5", q=like)
        out["resources"] = rows(db, "SELECT id, resource_name, category, fn_stock_status(id) AS stock_status FROM resources WHERE resource_name ILIKE :q LIMIT 5", q=like)
    return out
