"""Test set-up: builds a throw-away database from the ORIGINAL original SQL scripts.

    TEST_ADMIN_URL=postgresql://dmers:dmers@localhost:5433/postgres pytest -q

The test database (default name dmers_app_test) is created from database/original/01_schema.sql,
02_plpgsql.sql and 03_seed_data.sql, then dropped at the end. Your own databases are never
touched: the tests refuse to run if the test database name is dmers, dmers_db or dmers_course.
"""
import os
import re
import tempfile
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import psycopg2
import pytest

ROOT = Path(__file__).resolve().parents[2]
ORIGINAL = ROOT / "database" / "original"
ADMIN_URL = os.getenv("TEST_ADMIN_URL", "postgresql://dmers:dmers@localhost:5433/postgres")
TEST_DB = os.getenv("TEST_DB_NAME", "dmers_app_test")
if TEST_DB in {"dmers", "dmers_db", "dmers_course"}:
    raise SystemExit(f"Refusing to use {TEST_DB} as a throw-away test database")


def _url_for(db: str) -> str:
    u = urlparse(ADMIN_URL)
    return urlunparse(u._replace(path="/" + db))


def run_sql_file(conn, path: Path):
    """Run a psql script through psycopg2 (psql backslash commands are skipped)."""
    sql = "\n".join(l for l in path.read_text(encoding="utf-8").splitlines() if not l.lstrip().startswith("\\"))
    with conn.cursor() as cur:
        cur.execute(sql)


def fresh_database(name: str, scripts=("01_schema.sql", "02_plpgsql.sql", "03_seed_data.sql")):
    admin = psycopg2.connect(ADMIN_URL)
    admin.autocommit = True
    with admin.cursor() as cur:
        cur.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        cur.execute(f'CREATE DATABASE "{name}"')
    admin.close()
    conn = psycopg2.connect(_url_for(name))
    conn.autocommit = True
    for s in scripts:
        run_sql_file(conn, ORIGINAL / s)
    conn.close()


def drop_database(name: str):
    admin = psycopg2.connect(ADMIN_URL)
    admin.autocommit = True
    with admin.cursor() as cur:
        cur.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
    admin.close()


def fingerprint(db_url: str) -> list[str]:
    """Runs database/checks/fingerprint.sql and returns its output lines."""
    text = (ROOT / "database" / "checks" / "fingerprint.sql").read_text(encoding="utf-8")
    stmts = [s.strip() for s in re.split(r";[ \t]*(?:--[^\n]*)?\n", "\n".join(
        l for l in text.splitlines() if not l.lstrip().startswith("\\") and not l.lstrip().startswith("--")))
        if s.strip()]
    out = []
    conn = psycopg2.connect(db_url)
    with conn.cursor() as cur:
        for s in stmts:
            cur.execute(s)
            if cur.description:
                out += [r[0] for r in cur.fetchall()]
    conn.close()
    return out


# ---- build the test database BEFORE the app is imported (settings read the environment)
fresh_database(TEST_DB)
TEST_URL = _url_for(TEST_DB)
BEFORE_MIGRATION = fingerprint(TEST_URL)
os.environ["DATABASE_URL"] = TEST_URL
os.environ["JWT_SECRET"] = "test-secret"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="dmers_uploads_")
os.environ["DMERS_AUTO_MIGRATE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

PASSWORD = "Dmers@2026"
ADMIN, COORD, COORD2, LEAD_SURESH, LEAD_ARUN, CITIZEN = (
    "meena.krishnan@dmers.example.org", "priya.natarajan@dmers.example.org",
    "rajesh.subramanian@dmers.example.org", "suresh.babu@dmers.example.org",
    "arun.prakash@dmers.example.org", "anitha.selvam@mail.example.com")


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:          # runs start-up: migration + schema check
        yield c
    drop_database(TEST_DB)


@pytest.fixture(scope="session")
def db_url():
    return TEST_URL


@pytest.fixture(scope="session")
def before_migration():
    return BEFORE_MIGRATION


def token(client, email, password=PASSWORD) -> dict:
    r = client.post("/api/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def h(client):
    return {name: token(client, email) for name, email in
            {"admin": ADMIN, "coord": COORD, "coord2": COORD2, "suresh": LEAD_SURESH,
             "arun": LEAD_ARUN, "citizen": CITIZEN}.items()}


def sql(db_url, query, *args):
    conn = psycopg2.connect(db_url)
    with conn.cursor() as cur:
        cur.execute(query, args)
        res = cur.fetchall() if cur.description else None
    conn.commit()
    conn.close()
    return res
