"""Small helpers for running SQL and shaping rows."""
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from .errors import RuleError


def _clean(v: Any) -> Any:
    return float(v) if isinstance(v, Decimal) else v


def rows(db: Session, sql: str, **params) -> list[dict]:
    return [{k: _clean(v) for k, v in r.items()} for r in db.execute(text(sql), params).mappings().all()]


def one(db: Session, sql: str, **params) -> dict | None:
    r = db.execute(text(sql), params).mappings().first()
    return {k: _clean(v) for k, v in r.items()} if r else None


def scalar(db: Session, sql: str, **params):
    return _clean(db.execute(text(sql), params).scalar())


def must(row: dict | None, what: str) -> dict:
    if row is None:
        raise RuleError(f"{what} not found", 404)
    return row


def jitter(base_lat: float | None, base_lng: float | None, seed: int, spread: float = 0.018):
    """Spread incidents of one zone around the zone centre so map pins do not overlap.

    Incidents have a text location (no coordinates) in the DMERS database design, so the map
    places each one near the centre of its zone, at a stable offset derived from its id.
    """
    if base_lat is None or base_lng is None:
        return None, None
    a = ((seed * 7919) % 1000) / 1000 - 0.5
    b = ((seed * 104729) % 1000) / 1000 - 0.5
    return round(base_lat + a * spread, 6), round(base_lng + b * spread, 6)


def run(db: Session, sql: str, **params):
    return db.execute(text(sql), params)
