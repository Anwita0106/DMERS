from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import RuleError
from ..models import User
from ..schemas import UserCreateIn, UserUpdateIn
from ..security import find_user_by_email, hash_password, require_roles
from ..sqlutil import must, one, rows, run, scalar

router = APIRouter(prefix="/api/users", tags=["users"])
admin = require_roles("ADMINISTRATOR")

USER_SQL = """
SELECT u.id, u.full_name, u.email, u.account_type, u.created_at,
       r.id AS unit_id, r.unit_name,
       (SELECT count(*) FROM incidents i WHERE i.reported_by = u.id) AS incidents_reported,
       (SELECT count(*) FROM dispatches d WHERE d.dispatched_by = u.id) AS dispatches_authorised
FROM users u LEFT JOIN response_units r ON r.lead_user_id = u.id
"""


@router.get("")
def list_users(role: Optional[str] = None, q: Optional[str] = None,
               _: User = Depends(admin), db: Session = Depends(get_db)):
    where, p = ["true"], {}
    if role:
        where.append("u.account_type = :role"); p["role"] = role
    if q:
        where.append("(u.full_name ILIKE :q OR u.email ILIKE :q)"); p["q"] = f"%{q}%"
    items = rows(db, USER_SQL + " WHERE " + " AND ".join(where) + " ORDER BY u.id", **p)
    counts = {r["account_type"]: r["n"] for r in rows(
        db, "SELECT account_type, count(*) AS n FROM users GROUP BY account_type")}
    return {"items": items, "role_counts": counts}


@router.get("/unit-leads")
def unit_leads(_: User = Depends(require_roles("ADMINISTRATOR", "COORDINATOR")), db: Session = Depends(get_db)):
    """UNIT_LEAD accounts with the unit each one leads (if any), for the unit form."""
    return rows(db, USER_SQL + " WHERE u.account_type = 'UNIT_LEAD' ORDER BY u.full_name")


@router.post("", status_code=201)
def create_user(body: UserCreateIn, _: User = Depends(admin), db: Session = Depends(get_db)):
    if find_user_by_email(db, body.email):
        raise RuleError("An account with this e-mail already exists")
    new_id = scalar(db, """INSERT INTO users (full_name, account_type, email, password_hash)
                           VALUES (:n, :t, :e, :h) RETURNING id""",
                    n=body.full_name, t=body.account_type, e=body.email.lower(), h=hash_password(body.password))
    db.commit()
    return one(db, USER_SQL + " WHERE u.id = :id", id=new_id)


@router.patch("/{user_id}")
def update_user(user_id: int, body: UserUpdateIn, me: User = Depends(admin), db: Session = Depends(get_db)):
    cur = must(one(db, "SELECT id, account_type FROM users WHERE id = :id", id=user_id), "User")
    if body.account_type and body.account_type != cur["account_type"]:
        if cur["account_type"] == "ADMINISTRATOR" and scalar(
                db, "SELECT count(*) FROM users WHERE account_type = 'ADMINISTRATOR'") <= 1:
            raise RuleError("At least one administrator account must remain")
        if cur["account_type"] == "UNIT_LEAD" and scalar(
                db, "SELECT count(*) FROM response_units WHERE lead_user_id = :id", id=user_id):
            raise RuleError("This person leads a response unit; assign a new lead to the unit first")
    sets, p = [], {"id": user_id}
    for col in ("full_name", "account_type"):
        val = getattr(body, col)
        if val is not None:
            sets.append(f"{col} = :{col}"); p[col] = val
    if sets:
        run(db, f"UPDATE users SET {', '.join(sets)} WHERE id = :id", **p)
        db.commit()
    return one(db, USER_SQL + " WHERE u.id = :id", id=user_id)
