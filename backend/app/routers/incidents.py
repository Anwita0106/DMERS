"""Incidents: reporting (FR-03), verification (FR-05), status changes and closing (FR-11).

Every status change is a plain UPDATE of incidents.status inside a transaction that has
dmers.actor_id set, so trigger T1 writes the timeline entry and T2 maintains updated_at,
exactly as in 02_plpgsql.sql. Closing calls the sp_close_incident procedure.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db, set_actor
from ..errors import RuleError
from ..models import User
from ..schemas import CloseIn, IncidentCreateIn, IncidentUpdateIn, StatusIn, VerifyIn
from ..security import STAFF, get_current_user, require_roles, require_staff
from ..sqlutil import jitter, must, one, rows, run, scalar

router = APIRouter(prefix="/api", tags=["incidents"])
managers = require_roles("COORDINATOR", "ADMINISTRATOR")

INCIDENT_SQL = """
SELECT i.id, i.title, i.description, i.incident_type, i.severity, i.status, i.location,
       i.zone_id, z.zone_name, z.district, z.risk_level AS zone_risk,
       i.reported_by, u.full_name AS reporter_name, i.created_at, i.updated_at,
       g.latitude AS zone_lat, g.longitude AS zone_lng,
       fn_response_minutes(i.id) AS response_minutes,
       (SELECT count(*) FROM dispatches d WHERE d.incident_id = i.id
          AND d.dispatch_status IN ('ASSIGNED', 'EN_ROUTE', 'ON_SCENE')) AS active_units,
       (SELECT count(*) FROM resource_allocations ra WHERE ra.incident_id = i.id) AS relief_items,
       (SELECT count(*) FROM app_incident_attachments a WHERE a.incident_id = i.id) AS photo_count
FROM incidents i
LEFT JOIN zones z ON z.id = i.zone_id
JOIN users u ON u.id = i.reported_by
LEFT JOIN app_zone_geo g ON g.zone_id = i.zone_id
"""

SORTS = {"newest": "i.created_at DESC", "oldest": "i.created_at ASC", "updated": "i.updated_at DESC",
         "severity": "array_position(ARRAY['CRITICAL','HIGH','MODERATE','LOW']::varchar[], i.severity), i.created_at DESC"}


def shape(r: dict) -> dict:
    r["latitude"], r["longitude"] = jitter(r.pop("zone_lat"), r.pop("zone_lng"), r["id"])
    return r


def actions_for(user: User, inc: dict) -> dict:
    mgr = user.account_type in ("COORDINATOR", "ADMINISTRATOR")
    st = inc["status"]
    return {
        "can_edit": mgr and st not in ("CLOSED", "REJECTED"),
        "can_verify": mgr and st == "REPORTED",
        "can_reject": mgr and st == "REPORTED",
        "can_resolve": mgr and st in ("VERIFIED", "RESPONDING") and inc["active_units"] == 0,
        "can_close": mgr and st in ("VERIFIED", "RESPONDING", "RESOLVED"),
        "can_dispatch": user.account_type == "COORDINATOR" and st in ("VERIFIED", "RESPONDING"),
        "can_allocate": mgr and st in ("VERIFIED", "RESPONDING"),
        "can_delete": user.account_type == "ADMINISTRATOR" and st == "REJECTED",
    }


def load(db: Session, incident_id: int) -> dict:
    return shape(must(one(db, INCIDENT_SQL + " WHERE i.id = :id", id=incident_id), "Incident"))


def can_view(user: User, inc: dict) -> bool:
    return user.account_type in STAFF or inc["reported_by"] == user.id


# ------------------------------------------------------------------------------- reads
@router.get("/incidents")
def list_incidents(
    q: Optional[str] = None, zone_id: Optional[int] = None, incident_type: Optional[str] = None,
    severity: Optional[str] = None, status: Optional[str] = Query(None, description="One value or a comma list"),
    open_only: bool = False, sort: str = "newest",
    page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=200),
    _: User = Depends(require_staff), db: Session = Depends(get_db),
):
    where, p = ["true"], {}
    if q:
        where.append("(i.title ILIKE :q OR i.location ILIKE :q OR i.description ILIKE :q OR i.id::text = :qid)")
        p["q"], p["qid"] = f"%{q}%", q.strip()
    if zone_id:
        where.append("i.zone_id = :zone_id"); p["zone_id"] = zone_id
    if incident_type:
        where.append("i.incident_type = :itype"); p["itype"] = incident_type.upper()
    if severity:
        where.append("i.severity = ANY(:sev)"); p["sev"] = [s.strip().upper() for s in severity.split(",")]
    if status:
        where.append("i.status = ANY(:st)"); p["st"] = [s.strip().upper() for s in status.split(",")]
    if open_only:
        where.append("i.status IN ('REPORTED', 'VERIFIED', 'RESPONDING')")
    w = " WHERE " + " AND ".join(where)
    total = scalar(db, "SELECT count(*) FROM incidents i" + w, **p)
    items = rows(db, INCIDENT_SQL + w + f" ORDER BY {SORTS.get(sort, SORTS['newest'])} LIMIT :lim OFFSET :off",
                 **p, lim=page_size, off=(page - 1) * page_size)
    return {"items": [shape(r) for r in items], "total": total, "page": page, "page_size": page_size}


@router.get("/incidents/types")
def incident_types(db: Session = Depends(get_db)):
    from ..models import INCIDENT_TYPES
    used = [r["incident_type"] for r in rows(db, "SELECT DISTINCT incident_type FROM incidents ORDER BY 1")]
    return sorted(set(INCIDENT_TYPES) | set(used))


@router.get("/incidents/mine")
def my_incidents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = rows(db, INCIDENT_SQL + " WHERE i.reported_by = :u ORDER BY i.created_at DESC", u=user.id)
    return [shape(r) for r in items]


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inc = load(db, incident_id)
    if not can_view(user, inc):
        raise RuleError("You can only view incidents you reported", 403)
    inc["timeline"] = rows(db, """
        SELECT t.update_no, t.previous_status, t.new_status, t.note, t.logged_at,
               t.logged_by, u.full_name AS logged_by_name, u.account_type AS logged_by_role
        FROM incident_updates t LEFT JOIN users u ON u.id = t.logged_by
        WHERE t.incident_id = :id ORDER BY t.update_no""", id=incident_id)
    inc["dispatches"] = rows(db, """
        SELECT d.incident_id, d.unit_id, r.unit_name, r.unit_type, r.contact_phone, d.dispatch_status,
               d.dispatched_at, d.arrived_at, d.cleared_at, d.dispatched_by, u.full_name AS dispatched_by_name
        FROM dispatches d JOIN response_units r ON r.id = d.unit_id JOIN users u ON u.id = d.dispatched_by
        WHERE d.incident_id = :id ORDER BY d.dispatched_at""", id=incident_id)
    inc["allocations"] = rows(db, """
        SELECT ra.incident_id, ra.resource_id, r.resource_name, r.category, r.unit_of_measure,
               ra.quantity, ra.allocated_at
        FROM resource_allocations ra JOIN resources r ON r.id = ra.resource_id
        WHERE ra.incident_id = :id ORDER BY ra.allocated_at""", id=incident_id)
    inc["attachments"] = rows(db, """SELECT id, file_name, content_type, size_bytes, uploaded_at
        FROM app_incident_attachments WHERE incident_id = :id ORDER BY id""", id=incident_id)
    inc["actions"] = actions_for(user, inc)
    if user.account_type not in STAFF:
        inc.pop("reporter_name", None)
    return inc


# ------------------------------------------------------------------------------ writes
@router.post("/incidents", status_code=201)
def create_incident(body: IncidentCreateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Any signed-in user reports an incident; it starts as REPORTED (column default)."""
    if body.zone_id is not None:
        must(one(db, "SELECT id FROM zones WHERE id = :z", z=body.zone_id), "Zone")
    set_actor(db, user.id)
    new_id = scalar(db, """
        INSERT INTO incidents (title, description, incident_type, severity, location, zone_id, reported_by)
        VALUES (:title, :description, :incident_type, :severity, :location, :zone_id, :uid) RETURNING id""",
        **body.model_dump(), uid=user.id)
    db.commit()
    return load(db, new_id)


@router.patch("/incidents/{incident_id}")
def update_incident(incident_id: int, body: IncidentUpdateIn, user: User = Depends(managers),
                    db: Session = Depends(get_db)):
    inc = load(db, incident_id)
    if inc["status"] in ("CLOSED", "REJECTED"):
        raise RuleError(f"A {inc['status']} incident can no longer be edited")
    data = body.model_dump(exclude_unset=True)
    if not data:
        return inc
    set_actor(db, user.id)
    run(db, f"UPDATE incidents SET {', '.join(f'{k} = :{k}' for k in data)} WHERE id = :id", **data, id=incident_id)
    db.commit()
    return load(db, incident_id)


@router.post("/incidents/{incident_id}/verify")
def verify_incident(incident_id: int, body: VerifyIn, user: User = Depends(managers), db: Session = Depends(get_db)):
    inc = load(db, incident_id)
    if inc["status"] != "REPORTED":
        raise RuleError(f"Only REPORTED incidents can be verified (this one is {inc['status']})")
    must(one(db, "SELECT id FROM zones WHERE id = :z", z=body.zone_id), "Zone")
    set_actor(db, user.id, body.note)
    run(db, """UPDATE incidents SET status = 'VERIFIED', zone_id = :z, severity = coalesce(:s, severity)
               WHERE id = :id""", z=body.zone_id, s=body.severity, id=incident_id)
    db.commit()
    return load(db, incident_id)


@router.post("/incidents/{incident_id}/status")
def change_status(incident_id: int, body: StatusIn, user: User = Depends(managers), db: Session = Depends(get_db)):
    """REPORTED -> VERIFIED | REJECTED, and VERIFIED/RESPONDING -> RESOLVED.

    RESPONDING is set by sp_dispatch_unit when the first unit is sent, and CLOSED by
    sp_close_incident, so neither can be set directly here.
    """
    inc = load(db, incident_id)
    cur, new = inc["status"], body.status
    if new == "VERIFIED":
        zone = body.zone_id or inc["zone_id"]
        if zone is None:
            raise RuleError("A zone must be assigned before an incident is verified (FR-05)", 422)
        return verify_incident(incident_id, VerifyIn(zone_id=zone, note=body.note), user, db)
    if new == "REJECTED" and cur != "REPORTED":
        raise RuleError("Only REPORTED incidents can be rejected")
    if new == "RESOLVED":
        if cur not in ("VERIFIED", "RESPONDING"):
            raise RuleError(f"Only VERIFIED or RESPONDING incidents can be resolved (this one is {cur})")
        if inc["active_units"]:
            raise RuleError("Units are still assigned. Complete or cancel their dispatches first, "
                            "or close the incident, which releases them.")
    set_actor(db, user.id, body.note)
    run(db, "UPDATE incidents SET status = :s WHERE id = :id", s=new, id=incident_id)
    db.commit()
    return load(db, incident_id)


@router.post("/incidents/{incident_id}/close")
def close_incident(incident_id: int, body: CloseIn, user: User = Depends(managers), db: Session = Depends(get_db)):
    """Calls sp_close_incident: its cursor releases every active unit, then RESOLVED -> CLOSED."""
    load(db, incident_id)
    run(db, "CALL sp_close_incident(:i, :u, :n)", i=incident_id, u=user.id, n=body.note)
    db.commit()
    return load(db, incident_id)


@router.delete("/incidents/{incident_id}", status_code=204)
def delete_incident(incident_id: int, _: User = Depends(require_roles("ADMINISTRATOR")), db: Session = Depends(get_db)):
    """Only a REJECTED report can be removed (as in 04_dml_demo.sql D5); its timeline cascades."""
    inc = load(db, incident_id)
    if inc["status"] != "REJECTED":
        raise RuleError("Only REJECTED incidents can be deleted")
    keys = [r["storage_key"] for r in rows(db, "SELECT storage_key FROM app_incident_attachments WHERE incident_id = :i", i=incident_id)]
    run(db, "DELETE FROM incidents WHERE id = :i AND status = 'REJECTED'", i=incident_id)
    db.commit()
    for k in keys:
        (settings.UPLOAD_DIR / k).unlink(missing_ok=True)


# ------------------------------------------------------------------------- attachments
SIGNATURES = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG\r\n\x1a\n": "image/png"}


def sniff(head: bytes) -> str | None:
    for sig, ctype in SIGNATURES.items():
        if head.startswith(sig):
            return ctype
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


@router.post("/incidents/{incident_id}/attachments", status_code=201)
async def upload_attachments(incident_id: int, files: list[UploadFile] = File(...),
                             user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inc = load(db, incident_id)
    if not can_view(user, inc):
        raise RuleError("You can only add photos to incidents you reported", 403)
    existing = scalar(db, "SELECT count(*) FROM app_incident_attachments WHERE incident_id = :i", i=incident_id)
    if existing + len(files) > settings.MAX_ATTACHMENTS_PER_INCIDENT:
        raise RuleError(f"At most {settings.MAX_ATTACHMENTS_PER_INCIDENT} photos per incident", 422)
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved, written = [], []
    try:
        for f in files:
            data = await f.read(settings.MAX_UPLOAD_BYTES + 1)
            if len(data) > settings.MAX_UPLOAD_BYTES:
                raise RuleError(f"{f.filename}: larger than 10 MB", 413)
            ctype = sniff(data[:16])
            if not data or ctype is None:
                raise RuleError(f"{f.filename}: only JPG, PNG or WEBP images are accepted", 415)
            key = f"{uuid.uuid4().hex}.{ctype.split('/')[1]}"
            (settings.UPLOAD_DIR / key).write_bytes(data)
            written.append(key)
            name = (f.filename or "photo").replace("/", "_").replace("\\", "_")[-120:]
            saved.append(scalar(db, """INSERT INTO app_incident_attachments
                (incident_id, file_name, content_type, size_bytes, storage_key, uploaded_by)
                VALUES (:i, :n, :c, :s, :k, :u) RETURNING id""",
                i=incident_id, n=name, c=ctype, s=len(data), k=key, u=user.id))
        db.commit()
    except Exception:
        db.rollback()
        for k in written:
            (settings.UPLOAD_DIR / k).unlink(missing_ok=True)
        raise
    return rows(db, "SELECT id, file_name, content_type, size_bytes, uploaded_at FROM app_incident_attachments "
                    "WHERE id = ANY(:ids) ORDER BY id", ids=saved)


@router.get("/attachments/{attachment_id}")
def get_attachment(attachment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = must(one(db, """SELECT a.*, i.reported_by FROM app_incident_attachments a
                        JOIN incidents i ON i.id = a.incident_id WHERE a.id = :id""", id=attachment_id), "Photo")
    if user.account_type not in STAFF and a["reported_by"] != user.id:
        raise RuleError("Not allowed", 403)
    path = settings.UPLOAD_DIR / a["storage_key"]
    if not path.exists():
        raise RuleError("Photo file is missing on the server", 404)
    return FileResponse(path, media_type=a["content_type"], filename=a["file_name"])
