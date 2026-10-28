"""End-to-end tests of the DMERS API against the original DMERS database objects."""
import io

from conftest import ROOT, fingerprint, fresh_database, drop_database, sql, token, _url_for

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


# ----------------------------------------------------------------- database preservation
def test_migration_preserves_original_objects_and_data(client, db_url, before_migration):
    """Start-up applied M001; the original tables, rules and rows are byte-for-byte the same."""
    after = fingerprint(db_url)
    assert len(before_migration) > 90
    assert before_migration == after


def test_migration_is_idempotent(client, db_url, before_migration):
    from app.migrate import run_migrations
    import psycopg2
    assert run_migrations() == []                 # already recorded
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    with conn.cursor() as cur:                    # run the file again by hand
        cur.execute((ROOT / "database/migrations/M001_app_extensions.sql").read_text())
    conn.close()
    assert fingerprint(db_url) == before_migration
    assert sql(db_url, "SELECT count(*) FROM app_shelters")[0][0] == 8
    assert sql(db_url, "SELECT count(*) FROM app_zone_geo")[0][0] == 12


def test_schema_check_refuses_v6_database():
    """A database with the old V6 tables is reported, not altered."""
    import psycopg2
    name = "dmers_app_test_v6"
    fresh_database(name, scripts=())
    url = _url_for(name)
    conn = psycopg2.connect(url)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("CREATE TABLE users (id SERIAL PRIMARY KEY, username VARCHAR(50), password_hash VARCHAR(255))")
        try:
            cur.execute((ROOT / "database/migrations/M001_app_extensions.sql").read_text())
            raised = False
        except psycopg2.Error as e:
            raised = "DMERS tables missing" in str(e) or "V6" in str(e)
            cur.execute("ROLLBACK")               # the file's own BEGIN left a failed transaction
        cur.execute("SELECT to_regclass('app_shelters')")
        assert cur.fetchone()[0] is None          # nothing was created
    conn.close()
    drop_database(name)
    assert raised


# ------------------------------------------------------------------------------ auth
def test_login_with_seeded_werkzeug_hash(client):
    r = client.post("/api/auth/login", data={"username": "Priya.Natarajan@dmers.example.org", "password": "Dmers@2026"})
    assert r.status_code == 200
    assert r.json()["user"]["account_type"] == "COORDINATOR"
    assert client.post("/api/auth/login", data={"username": "priya.natarajan@dmers.example.org",
                                                 "password": "wrong"}).status_code == 401


def test_register_creates_citizen_with_scrypt_hash(client, db_url):
    r = client.post("/api/auth/register", json={"full_name": "Test Citizen", "email": "test.citizen@mail.example.com",
                                                "password": "Secret123"})
    assert r.status_code == 201, r.text
    assert r.json()["user"]["account_type"] == "CITIZEN"
    assert sql(db_url, "SELECT password_hash FROM users WHERE email = 'test.citizen@mail.example.com'")[0][0].startswith("scrypt:")
    dup = client.post("/api/auth/register", json={"full_name": "X Y", "email": "test.citizen@mail.example.com",
                                                  "password": "Secret123"})
    assert dup.status_code == 409


def test_me_requires_token(client, h):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=h["admin"]).json()["account_type"] == "ADMINISTRATOR"


# ------------------------------------------------------------------------- public API
def test_public_endpoints_need_no_login(client):
    s = client.get("/api/public/summary").json()
    assert s["active_incidents"] == 5 and s["shelters_open"] == 6
    assert all("reported_by" not in a and "reporter_name" not in a for a in s["alerts"])
    assert len(client.get("/api/zones").json()) == 12
    assert client.get("/api/shelters?available_only=true").status_code == 200
    assert client.get("/api/incidents").status_code == 401


# ---------------------------------------------------------------------- incident flow
def test_full_incident_lifecycle(client, h, db_url):
    divya = token(client, "divya.ramesh@dmers.example.org")
    # citizen reports (FR-03); trigger T1 writes timeline entry 1 authored by the reporter
    r = client.post("/api/incidents", headers=h["citizen"], json={
        "title": "Flooded street near Katpadi market", "description": "Knee-deep water",
        "incident_type": "flood", "location": "Market Road, Katpadi"})
    assert r.status_code == 201, r.text
    inc = r.json()
    iid = inc["id"]
    assert inc["status"] == "REPORTED" and inc["severity"] == "MODERATE" and inc["incident_type"] == "FLOOD"
    assert sql(db_url, "SELECT update_no, new_status, logged_by FROM incident_updates WHERE incident_id = %s", iid) == [(1, "REPORTED", 10)]

    # citizens cannot see the command-center list, nor other people's reports
    assert client.get("/api/incidents", headers=h["citizen"]).status_code == 403
    assert client.get("/api/incidents/7", headers=h["citizen"]).status_code == 200      # reported by Anitha (10)
    assert client.get("/api/incidents/12", headers=h["citizen"]).status_code == 403
    assert any(i["id"] == iid for i in client.get("/api/incidents/mine", headers=h["citizen"]).json())

    # verification needs a zone (ck_incidents_zone_when_verified / FR-05)
    assert client.post(f"/api/incidents/{iid}/status", headers=h["coord"], json={"status": "VERIFIED"}).status_code == 422
    assert client.post(f"/api/incidents/{iid}/verify", headers=h["citizen"], json={"zone_id": 2}).status_code == 403
    r = client.post(f"/api/incidents/{iid}/verify", headers=h["coord"],
                    json={"zone_id": 2, "severity": "HIGH", "note": "Confirmed by field call"})
    assert r.status_code == 200 and r.json()["status"] == "VERIFIED" and r.json()["severity"] == "HIGH"
    assert sql(db_url, "SELECT previous_status, new_status, note, logged_by FROM incident_updates "
                       "WHERE incident_id = %s AND update_no = 2", iid) == [("REPORTED", "VERIFIED", "Confirmed by field call", 3)]

    # only a COORDINATOR may dispatch: sp_dispatch_unit rejects the administrator
    r = client.post("/api/dispatches", headers=h["admin"], json={"incident_id": iid, "unit_id": 2})
    assert r.status_code == 409 and "not authorised" in r.json()["detail"]
    # trigger T3 (BR-05): a DEPLOYED unit cannot be sent
    r = client.post("/api/dispatches", headers=h["coord"], json={"incident_id": iid, "unit_id": 9})
    assert r.status_code == 409 and "not AVAILABLE" in r.json()["detail"]
    r = client.post("/api/dispatches", headers=h["coord"], json={"incident_id": iid, "unit_id": 2})
    assert r.status_code == 201, r.text
    assert r.json()["dispatch_status"] == "ASSIGNED"
    detail = client.get(f"/api/incidents/{iid}", headers=h["coord"]).json()
    assert detail["status"] == "RESPONDING" and detail["active_units"] == 1
    assert sql(db_url, "SELECT availability_status FROM response_units WHERE id = 2")[0][0] == "DEPLOYED"

    # dispatch progress: invalid jump refused; another unit's lead refused; own lead allowed
    assert client.patch(f"/api/dispatches/{iid}/2", headers=h["coord"], json={"dispatch_status": "COMPLETED"}).status_code == 409
    assert client.patch(f"/api/dispatches/{iid}/2", headers=h["suresh"], json={"dispatch_status": "EN_ROUTE"}).status_code == 403
    assert client.patch(f"/api/dispatches/{iid}/2", headers=divya, json={"dispatch_status": "EN_ROUTE"}).status_code == 200
    r = client.patch(f"/api/dispatches/{iid}/2", headers=divya, json={"dispatch_status": "ON_SCENE"})
    assert r.status_code == 200 and r.json()["arrived_at"] is not None
    assert client.get(f"/api/incidents/{iid}", headers=h["coord"]).json()["response_minutes"] is not None

    # relief allocation: trigger T4 moves stock and notes it on the timeline
    stock = sql(db_url, "SELECT quantity_available FROM resources WHERE id = 1")[0][0]
    r = client.post("/api/allocations", headers=h["coord"], json={"incident_id": iid, "resource_id": 1, "quantity": 100})
    assert r.status_code == 201, r.text
    assert sql(db_url, "SELECT quantity_available FROM resources WHERE id = 1")[0][0] == stock - 100
    r = client.post("/api/allocations", headers=h["coord"], json={"incident_id": iid, "resource_id": 1, "quantity": 50})
    assert r.json()["quantity"] == 150                                      # cumulative, as in the seed
    last_note = sql(db_url, "SELECT note, logged_by FROM incident_updates WHERE incident_id = %s "
                            "ORDER BY update_no DESC LIMIT 1", iid)[0]
    assert last_note == ("Allocated 50 Food packets", 3)
    r = client.post("/api/allocations", headers=h["coord"], json={"incident_id": iid, "resource_id": 11, "quantity": 1})
    assert r.status_code == 409 and "Insufficient stock" in r.json()["detail"]     # boats are out of stock
    r = client.patch(f"/api/allocations/{iid}/1", headers=h["coord"], json={"quantity": 120})
    assert r.status_code == 200
    assert sql(db_url, "SELECT quantity_available FROM resources WHERE id = 1")[0][0] == stock - 120
    assert client.delete(f"/api/allocations/{iid}/1", headers=h["coord"]).status_code == 204
    assert sql(db_url, "SELECT quantity_available FROM resources WHERE id = 1")[0][0] == stock

    # resolve is refused while a unit is on scene; close (sp_close_incident) releases it
    r = client.post(f"/api/incidents/{iid}/status", headers=h["coord"], json={"status": "RESOLVED"})
    assert r.status_code == 409
    r = client.post(f"/api/incidents/{iid}/close", headers=h["coord"], json={"note": "Water drained"})
    assert r.status_code == 200 and r.json()["status"] == "CLOSED"
    assert sql(db_url, "SELECT dispatch_status FROM dispatches WHERE incident_id = %s AND unit_id = 2", iid)[0][0] == "COMPLETED"
    assert sql(db_url, "SELECT availability_status FROM response_units WHERE id = 2")[0][0] == "AVAILABLE"
    tl = client.get(f"/api/incidents/{iid}", headers=h["coord"]).json()["timeline"]
    assert [t["new_status"] for t in tl][-2:] == ["RESOLVED", "CLOSED"]
    assert tl[-1]["note"] == "Water drained" and tl[-1]["logged_by"] == 3
    # closed incidents cannot be edited or receive relief
    assert client.patch(f"/api/incidents/{iid}", headers=h["coord"], json={"title": "New title"}).status_code == 409
    assert client.post("/api/allocations", headers=h["coord"], json={"incident_id": iid, "resource_id": 1, "quantity": 1}).status_code == 409


def test_unit_lead_updates_only_own_unit(client, h, db_url):
    assert client.patch("/api/dispatches/7/9", headers=h["suresh"], json={"dispatch_status": "COMPLETED"}).status_code == 403
    r = client.patch("/api/dispatches/7/9", headers=h["arun"], json={"dispatch_status": "COMPLETED"})
    assert r.status_code == 200 and r.json()["cleared_at"] is not None
    assert sql(db_url, "SELECT availability_status FROM response_units WHERE id = 9")[0][0] == "AVAILABLE"


def test_reject_and_delete_rejected_report(client, h, db_url):
    assert client.post("/api/incidents/13/status", headers=h["coord"], json={"status": "REJECTED", "note": "Duplicate"}).json()["status"] == "REJECTED"
    assert client.delete("/api/incidents/13", headers=h["coord"]).status_code == 403
    assert client.delete("/api/incidents/12", headers=h["admin"]).status_code == 409       # not rejected
    assert client.delete("/api/incidents/13", headers=h["admin"]).status_code == 204
    assert sql(db_url, "SELECT count(*) FROM incident_updates WHERE incident_id = 13")[0][0] == 0   # cascade (T5 allows)


def test_incident_list_filters_and_paging(client, h):
    r = client.get("/api/incidents?status=RESPONDING,VERIFIED&page_size=2&sort=severity", headers=h["coord"]).json()
    assert r["total"] >= 4 and len(r["items"]) == 2
    assert r["items"][0]["severity"] == "CRITICAL"
    r = client.get("/api/incidents?q=Palar", headers=h["suresh"]).json()
    assert r["total"] == 1 and r["items"][0]["latitude"] is not None


# ------------------------------------------------------------- units / resources / zones
def test_units_rules(client, h):
    body = {"unit_name": "Test Rescue Team", "unit_type": "RESCUE", "contact_phone": "9876543210",
            "personnel_count": 5, "zone_id": 2}
    assert client.post("/api/units", headers=h["coord"], json=body).status_code == 403
    assert client.post("/api/units", headers=h["admin"], json={**body, "contact_phone": "12345"}).status_code == 422
    r = client.post("/api/units", headers=h["admin"], json=body)
    assert r.status_code == 201 and r.json()["availability_status"] == "AVAILABLE"
    assert client.post("/api/units", headers=h["admin"], json=body).status_code == 409        # uq_units_name
    uid = r.json()["id"]
    assert client.patch(f"/api/units/{uid}", headers=h["admin"], json={"lead_user_id": 10}).status_code == 422  # a citizen
    assert client.patch(f"/api/units/{uid}", headers=h["admin"], json={"lead_user_id": 5}).status_code == 409   # uq_units_lead
    assert client.patch(f"/api/units/{uid}", headers=h["coord"], json={"availability_status": "OFF_DUTY"}).json()["availability_status"] == "OFF_DUTY"
    assert client.patch("/api/units/1", headers=h["coord"], json={"availability_status": "OFF_DUTY"}).status_code == 409  # on a dispatch


def test_resources_restock_and_stock_status(client, h):
    assert client.patch("/api/resources/8", headers=h["coord"], json={"restock": 100}).status_code == 403
    r = client.patch("/api/resources/8", headers=h["admin"], json={"restock": 100})
    assert r.status_code == 200 and r.json()["quantity_available"] == 150 and r.json()["stock_status"] == "ADEQUATE"
    low = client.get("/api/resources?stock_status=OUT_OF_STOCK", headers=h["coord"]).json()
    assert [x["resource_name"] for x in low] == ["Inflatable rescue boats"]


def test_zones_and_shelters(client, h):
    z = client.post("/api/zones", headers=h["admin"], json={"zone_name": "Test Zone", "district": "Vellore",
                                                           "risk_level": "LOW", "latitude": 12.9, "longitude": 79.1})
    assert z.status_code == 201 and z.json()["latitude"] == 12.9 and z.json()["state"] == "Tamil Nadu"
    s = client.post("/api/shelters", headers=h["coord"], json={
        "shelter_name": "Test Shelter", "zone_id": z.json()["id"], "address": "Main Road", "capacity": 10,
        "current_occupancy": 10, "latitude": 12.9, "longitude": 79.1})
    assert s.status_code == 201 and s.json()["status"] == "FULL"
    r = client.patch(f"/api/shelters/{s.json()['id']}", headers=h["coord"], json={"current_occupancy": 4})
    assert r.json()["status"] == "OPEN" and r.json()["available"] == 6
    assert client.patch(f"/api/shelters/{s.json()['id']}", headers=h["coord"], json={"current_occupancy": 11}).status_code == 422
    assert client.post("/api/shelters", headers=h["citizen"], json={}).status_code == 403


def test_photo_upload(client, h):
    r = client.post("/api/incidents/12/attachments", headers=h["coord"],
                    files=[("files", ("scene.png", io.BytesIO(PNG), "image/png"))])
    assert r.status_code == 201, r.text
    aid = r.json()[0]["id"]
    got = client.get(f"/api/attachments/{aid}", headers=h["coord"])
    assert got.status_code == 200 and got.content == PNG
    assert client.get(f"/api/attachments/{aid}", headers=h["citizen"]).status_code == 403   # not her report
    bad = client.post("/api/incidents/12/attachments", headers=h["coord"],
                      files=[("files", ("x.png", io.BytesIO(b"not an image"), "image/png"))])
    assert bad.status_code == 415


# ---------------------------------------------------------------------------- users
def test_user_admin(client, h):
    assert client.get("/api/users", headers=h["coord"]).status_code == 403
    users = client.get("/api/users", headers=h["admin"]).json()
    assert users["role_counts"]["ADMINISTRATOR"] == 1
    assert client.patch("/api/users/1", headers=h["admin"], json={"account_type": "CITIZEN"}).status_code == 409
    assert client.patch("/api/users/5", headers=h["admin"], json={"account_type": "CITIZEN"}).status_code == 409  # leads unit 1
    r = client.post("/api/users", headers=h["admin"], json={"full_name": "New Coordinator", "email": "new.coord@dmers.example.org",
                                                            "password": "Secret123", "account_type": "COORDINATOR"})
    assert r.status_code == 201 and r.json()["account_type"] == "COORDINATOR"
    assert client.patch(f"/api/users/{r.json()['id']}", headers=h["admin"], json={"account_type": "UNIT_LEAD"}).json()["account_type"] == "UNIT_LEAD"


# ------------------------------------------------------------------------- insights
def test_dashboard_analytics_search(client, h):
    d = client.get("/api/dashboard/stats", headers=h["coord"]).json()
    assert {"kpis", "units", "shelters", "low_stock", "recent", "activity", "zones", "map"} <= set(d)
    assert d["map"]["incidents"] and all(i["latitude"] for i in d["map"]["incidents"])
    a = client.get("/api/analytics?days=0", headers=h["coord"]).json()
    assert a["range_start"] == "2026-10-01" and sum(x["value"] for x in a["by_status"]) == a["totals"]["total"]
    assert client.get("/api/analytics", headers=h["citizen"]).status_code == 403
    s = client.get("/api/search?q=katpadi", headers=h["coord"]).json()
    assert s["zones"] and s["units"] and "incidents" in s
    assert "incidents" not in client.get("/api/search?q=katpadi").json()
