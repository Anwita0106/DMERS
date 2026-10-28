"""Compares the SQLAlchemy models with the live database (read-only).

Run at start-up: the API refuses to start against a database that is not the DMERS
design (for example the old V6 schema), instead of trying to "fix" it.
"""
from dataclasses import dataclass, field

from sqlalchemy import text

from .db import engine, Base
from . import models

REQUIRED_ROUTINES = ("fn_stock_status", "fn_active_incidents", "fn_response_minutes",
                     "sp_dispatch_unit", "sp_close_incident")
REQUIRED_TRIGGERS = ("trg_incidents_timeline", "trg_incidents_touch", "trg_dispatches_guard",
                     "trg_allocations_stock", "trg_incident_updates_append_only")


@dataclass
class SchemaReport:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    info: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    def lines(self) -> list[str]:
        return ([f"OK    {m}" for m in self.info] + [f"WARN  {m}" for m in self.warnings]
                + [f"ERROR {m}" for m in self.errors])


def check_schema() -> SchemaReport:
    rep = SchemaReport()
    with engine.connect() as conn:
        cols = conn.execute(text("""
            SELECT table_name, column_name, is_nullable
            FROM information_schema.columns WHERE table_schema = 'public'""")).all()
        live: dict[str, dict[str, str]] = {}
        for t, c, n in cols:
            live.setdefault(t, {})[c] = n

        for name in models.CORE_TABLES + models.APP_TABLES:
            table = Base.metadata.tables.get(name)
            if name not in live:
                rep.errors.append(f"table {name} is missing" + (
                    "" if name in models.CORE_TABLES else " (run: python -m app.migrate)"))
                continue
            if table is None:
                continue
            for col in table.columns:
                if col.name not in live[name]:
                    rep.errors.append(f"{name}.{col.name} is missing in the database")
                elif (live[name][col.name] == "YES") != bool(col.nullable):
                    rep.warnings.append(f"{name}.{col.name} nullability differs from the model")
            extra = set(live[name]) - {c.name for c in table.columns}
            if extra:
                rep.warnings.append(f"{name} has extra columns not used by the API: {', '.join(sorted(extra))}")
        if "users" in live and "username" in live["users"] and "account_type" not in live["users"]:
            rep.errors.append("users looks like the old V6 schema (username column). Point DATABASE_URL "
                              "at the DMERS database.")

        routines = {r[0] for r in conn.execute(text(
            "SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
            "WHERE n.nspname = 'public'"))}
        for r in REQUIRED_ROUTINES:
            if r not in routines:
                rep.errors.append(f"function/procedure {r} is missing (load 02_plpgsql.sql)")
        triggers = {r[0] for r in conn.execute(text("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal"))}
        for t in REQUIRED_TRIGGERS:
            if t not in triggers:
                rep.errors.append(f"trigger {t} is missing (load 02_plpgsql.sql)")
    if rep.ok:
        rep.info.append("DMERS schema present: 8 tables, 3 functions, 2 procedures, 5 triggers")
    return rep
