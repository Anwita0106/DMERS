"""DMERS end-to-end check: settings -> PostgreSQL -> schema -> demo login -> API -> website proxy.

    python tools/diagnose.py          (windows\\DIAGNOSE.bat runs this)

Read-only: it never changes the database. Prints OK / FAIL lines with the fix for each failure.
"""
import json
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
API_PORT, WEB_PORT = 8765, 5288
failures = 0


def ok(msg):
    print(f"  OK    {msg}")


def fail(msg, fix):
    global failures
    failures += 1
    print(f"  FAIL  {msg}\n        -> {fix}")


def port_open(port):
    with socket.socket() as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) == 0


def get(url, data=None):
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return None, str(e)


print("\n[1] Settings (backend\\.env)")
env = ROOT / "backend" / ".env"
if env.exists():
    ok(f"found {env}")
else:
    fail("backend\\.env not found", "copy windows\\dmers_settings.env backend\\.env  and fill in your PostgreSQL details")
try:
    from app.config import settings
    from sqlalchemy.engine import make_url
    u = make_url(settings.DATABASE_URL)
    ok(f"database = {u.database} on {u.host}:{u.port} as user {u.username}")
except Exception as e:  # noqa: BLE001
    fail(f"could not read settings: {e}", "run windows\\1_SETUP.bat to install the Python packages")
    sys.exit(1)

print("\n[2] PostgreSQL connection")
try:
    from sqlalchemy import text
    from app.db import engine
    with engine.connect() as c:
        ver = c.execute(text("SHOW server_version")).scalar()
        db = c.execute(text("SELECT current_database()")).scalar()
    ok(f"connected to PostgreSQL {ver}, database {db}")
except Exception as e:  # noqa: BLE001
    msg = str(e).splitlines()[0]
    fix = ("wrong DB_PASSWORD or DB_USER in backend\\.env" if "password" in msg
           else "wrong DB_PORT, or PostgreSQL is not running (pgAdmin: is the server connected?)" if "refused" in msg or "timeout" in msg
           else "wrong DB_NAME in backend\\.env" if "does not exist" in msg else "see the message above")
    fail(msg, fix)
    print(f"\n{failures} problem(s) found. Fix them and run this again.")
    sys.exit(1)

print("\n[3] DMERS schema and data")
from app.schema_check import check_schema  # noqa: E402
from app.migrate import run_migrations  # noqa: E402
rep = check_schema()
missing_app = [e for e in rep.errors if "app.migrate" in e]
if missing_app:
    print("  ..    app tables missing; applying the additive migration M001")
    run_migrations()
    rep = check_schema()
for line in rep.lines():
    print("  " + line)
if rep.ok:
    with engine.connect() as c:
        counts = {t: c.execute(text(f"SELECT count(*) FROM {t}")).scalar() for t in
                  ("users", "zones", "incidents", "response_units", "resources", "dispatches", "resource_allocations", "app_shelters")}
    ok("rows: " + ", ".join(f"{k}={v}" for k, v in counts.items()))
else:
    fail("the database is not the DMERS schema", "set DB_NAME to the database that has the 8 DMERS tables (e.g. dmers_course)")

print("\n[4] Demo login account")
from werkzeug.security import check_password_hash  # noqa: E402
with engine.connect() as c:
    row = c.execute(text("SELECT email, account_type, password_hash FROM users WHERE lower(email) = 'priya.natarajan@dmers.example.org'")).first()
if not row:
    fail("priya.natarajan@dmers.example.org not found in users", "load database/original/03_seed_data.sql, or sign in with your own account")
elif check_password_hash(row[2], "Dmers@2026"):
    ok(f"{row[0]} ({row[1]}) - password Dmers@2026 matches the stored hash")
else:
    fail("the stored hash does not match Dmers@2026", "this account's password was changed; use its current password")

print(f"\n[5] DMERS API on http://127.0.0.1:{API_PORT}")
if not port_open(API_PORT):
    fail(f"nothing is listening on port {API_PORT}", "run windows\\2_START.bat (keep the \"DMERS API\" window open) and read any error in that window")
else:
    code, body = get(f"http://127.0.0.1:{API_PORT}/api/health")
    if code == 200 and '"dmers-api"' in body:
        ok(f"/api/health -> {body}")
        code, body = get(f"http://127.0.0.1:{API_PORT}/openapi.json")
        paths = sorted(json.loads(body)["paths"]) if code == 200 else []
        need = ["/api/auth/login", "/api/public/summary", "/api/shelters", "/api/zones", "/api/incidents", "/api/incidents/types"]
        miss = [p for p in need if p not in paths]
        (ok(f"{len(paths)} API routes registered, including login, summary, shelters, zones, incidents") if not miss
         else fail(f"routes missing: {miss}", "an old backend copy is running; run windows\\STOP_DMERS.bat then windows\\2_START.bat"))
        code, body = get(f"http://127.0.0.1:{API_PORT}/api/auth/login",
                         b"username=priya.natarajan%40dmers.example.org&password=Dmers%402026")
        (ok("POST /api/auth/login -> 200, token issued") if code == 200
         else fail(f"login returned {code}: {body[:150]}", "see the \"DMERS API\" window"))
    else:
        fail(f"port {API_PORT} answers but it is not the DMERS API ({code}: {body[:120]})",
             "run windows\\STOP_DMERS.bat, then windows\\2_START.bat")

print(f"\n[6] Website on http://localhost:{WEB_PORT} (forwards /api to the API)")
if not port_open(WEB_PORT):
    fail(f"nothing is listening on port {WEB_PORT}", "run windows\\2_START.bat; keep the \"DMERS Website\" window open")
else:
    code, body = get(f"http://127.0.0.1:{WEB_PORT}/api/health")
    if code == 200 and '"dmers-api"' in body:
        ok("website -> /api/health reaches the DMERS API")
    else:
        fail(f"website -> /api/health returned {code}: {body[:120]}",
             "another program owns port 5288; run windows\\STOP_DMERS.bat then windows\\2_START.bat")
for p in (5173, 5174, 5175, 8000):
    if port_open(p):
        print(f"  note  port {p} is also in use by another program (another project, e.g. SplitPay). "
              f"DMERS is only at http://localhost:{WEB_PORT}.")

print("\n" + ("ALL CHECKS PASSED - open http://localhost:5288" if failures == 0 else f"{failures} problem(s) found - fix the FAIL lines above."))
