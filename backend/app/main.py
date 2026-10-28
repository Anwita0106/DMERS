"""DMERS API: FastAPI on the DMERS PostgreSQL design."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import DBAPIError

from .config import settings
from .errors import RuleError, db_error_handler, rule_error_handler
from .migrate import run_migrations
from .routers import auth, incidents, insights, operations, users, zones
from .schema_check import check_schema

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("dmers")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.AUTO_MIGRATE:
        applied = run_migrations()
        log.info("Migrations: %s", ", ".join(applied) if applied else "up to date")
    report = check_schema()
    for line in report.lines():
        (log.error if line.startswith("ERROR") else log.warning if line.startswith("WARN") else log.info)(line)
    if not report.ok:
        raise RuntimeError("The database is not the DMERS schema; see the errors above. "
                           "Nothing was changed.")
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="DMERS API", version="1.0.0", lifespan=lifespan,
              description="Disaster Management & Emergency Response System on the DMERS database.")
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_origin_regex=settings.CORS_ORIGIN_REGEX,
                   allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.add_exception_handler(RuleError, rule_error_handler)
app.add_exception_handler(DBAPIError, db_error_handler)

for r in (auth, users, incidents, operations, zones, insights):
    app.include_router(r.router)


@app.get("/api/health", tags=["meta"])
def health():
    """Identifies this server as the DMERS API and checks the database connection."""
    from sqlalchemy import text
    from .db import engine
    with engine.connect() as c:
        row = c.execute(text("""SELECT current_database(), current_user,
                                       (SELECT string_agg(version, ',' ORDER BY version) FROM app_schema_migrations WHERE version LIKE 'M%'),
                                       (SELECT count(*) FROM incidents), (SELECT count(*) FROM users)""")).one()
    return {"status": "ok", "service": "dmers-api", "api": app.version, "database": row[0], "db_user": row[1],
            "migrations": row[2], "incidents": row[3], "users": row[4]}
