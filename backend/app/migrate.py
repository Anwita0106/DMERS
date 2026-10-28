"""Applies database/migrations/*.sql in name order, additive only.

Each file is idempotent and records itself in app_schema_migrations, so running this on an
existing database any number of times is safe. Nothing is dropped, reset or recreated.

    python -m app.migrate            # apply pending migrations
    python -m app.migrate --check    # only report the schema check
"""
import logging
import sys

from sqlalchemy import text

from .config import settings
from .db import engine
from .schema_check import check_schema

log = logging.getLogger("dmers.migrate")


def applied_versions() -> set[str]:
    with engine.connect() as conn:
        exists = conn.execute(text("SELECT to_regclass('public.app_schema_migrations')")).scalar()
        if not exists:
            return set()
        return {r[0] for r in conn.execute(text("SELECT version FROM app_schema_migrations"))}


def run_migrations() -> list[str]:
    files = sorted(settings.MIGRATIONS_DIR.glob("M*.sql"))
    if not files:
        log.warning("No migration files found in %s", settings.MIGRATIONS_DIR)
        return []
    done = applied_versions()
    applied = []
    for path in files:
        version = path.stem.split("_", 1)[0]  # e.g. M001
        if version in done:
            continue
        sql = path.read_text(encoding="utf-8")
        raw = engine.raw_connection()
        try:
            raw.autocommit = True        # the file has its own BEGIN ... COMMIT
            with raw.cursor() as cur:
                cur.execute(sql)
        finally:
            raw.close()
        log.info("Applied migration %s", path.name)
        applied.append(path.name)
    return applied


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    if "--check" not in sys.argv:
        names = run_migrations()
        print("Applied:", ", ".join(names) if names else "nothing (already up to date)")
    report = check_schema()
    for line in report.lines():
        print(line)
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
