# DMERS — Disaster Management & Emergency Response System

A web app for reporting disasters and coordinating the response: citizens report incidents,
the control room verifies them, dispatches response units and allocates relief. It runs on
**your own PostgreSQL database**. All business rules (constraints, triggers and stored
procedures) live in the database, and the website shows its data **live**.

**Stack:** React + TypeScript (website) → FastAPI / Python (API) → PostgreSQL (database).

---

## Contents
1. [Quick start on Windows](#1-quick-start-on-windows)
2. [Starting again after a restart](#2-starting-again-after-a-restart)
3. [Demo accounts](#3-demo-accounts)
4. [Showing the database working live](#4-showing-the-database-working-live)
5. [Screenshots](#5-screenshots)
6. [System architecture](#6-system-architecture)
7. [Who can do what](#7-who-can-do-what)
8. [What the app adds to the database](#8-what-the-app-adds-to-the-database)
9. [Troubleshooting](#9-troubleshooting)
10. [Other ways to run (Docker, manual)](#10-other-ways-to-run)
11. [Tests](#11-tests)
12. [Project layout](#12-project-layout)

---

## 1. Quick start on Windows

**You need (one time):**
* **PostgreSQL** with the DMERS database loaded: the 8 tables from `database/original/`
  (for example the database `dmers_course`).
* **Python 3.11 or newer.** Tick **"Add python.exe to PATH"** when installing.
* **Node.js LTS.**

**Steps:**
1. Unzip the project and open the folder in VS Code (File → Open Folder).
2. Open a terminal (Terminal → New Terminal) and create your settings file:
   ```
   copy windows\dmers_settings.env backend\.env
   notepad backend\.env
   ```
   Fill in your PostgreSQL details, then save and close:
   ```
   DB_PORT=5433            (pgAdmin: right-click your server → Properties → Connection → Port)
   DB_NAME=dmers_course
   DB_USER=postgres
   DB_PASSWORD=your-password      (type it exactly; characters like @ are fine)
   ```
3. Run the one-time setup:
   ```
   windows\1_SETUP.bat
   ```
   It installs the packages, downloads the disaster photos and checks the database. It should end with
   `OK    DMERS schema present: 8 tables, 3 functions, 2 procedures, 5 triggers`.
4. Start DMERS:
   ```
   windows\2_START.bat
   ```
   Two windows open ("DMERS API" and "DMERS Website"). Keep them open. The browser opens
   **http://localhost:5288**.

| What | Address |
|---|---|
| Website | **https://dmers-ten.vercel.app/** |
| API (backend) | https://dmers-api.onrender.com/ |

---

## 2. Starting again after a restart

Your data is safe in PostgreSQL. You do **not** need to run the setup again.

1. Open the project folder in VS Code and open a terminal.
2. Run `windows\2_START.bat`.
3. Use **http://localhost:5288**.

* **PostgreSQL not running?** Press `Win + R`, type `services.msc`, find **postgresql-x64-18**
  (or your version), right-click it and choose **Start**.
* **"Port already in use"?** Run `windows\STOP_DMERS.bat`, then `windows\2_START.bat`.

---

## 3. Demo accounts

These come from `database/original/03_seed_data.sql`. The password for all of them is **`Dmers@2026`**.

| Role | E-mail | Can do |
|---|---|---|
| Administrator | meena.krishnan@dmers.example.org | Users, units, zones, resource stock |
| Coordinator | priya.natarajan@dmers.example.org | Verify, dispatch, allocate relief, close incidents |
| Unit lead | arun.prakash@dmers.example.org | Update his unit's dispatch progress |
| Citizen | anitha.selvam@mail.example.com | Report incidents, follow own reports |

On the login page, open **Demo accounts** and click a name to sign in with one click.

---

## 4. Showing the database working live

Put **pgAdmin** (Query Tool on your DMERS database) and the **website** side by side
(`Win + ←` and `Win + →`).

### A. Website → database: every action is saved
```sql
-- 1. latest incidents (run before and after reporting one on the website)
SELECT id, title, status, created_at FROM incidents ORDER BY id DESC LIMIT 5;

-- 2. the timeline the TRIGGER writes for the newest incident (grows with every click)
SELECT update_no, previous_status, new_status, note, logged_at
FROM incident_updates
WHERE incident_id = (SELECT max(id) FROM incidents)
ORDER BY update_no;

-- 3. stock goes down when relief is allocated (stock trigger + fn_stock_status)
SELECT resource_name, quantity_available, fn_stock_status(id) AS stock_status
FROM resources ORDER BY id;
```
Flow:
1. Report an incident as a citizen. In query 2, row 1 appears (`REPORTED`).
2. As the coordinator, **Verify** it. Row 2 appears (`REPORTED → VERIFIED`).
3. **Dispatch unit.** Row 3 appears (`VERIFIED → RESPONDING`, done by `sp_dispatch_unit`).
4. **Allocate relief.** Row 4 appears ("Allocated 20 Food packets"), and query 3 shows less stock.

### B. Database → website: appears within 5 seconds
Keep the Command Center dashboard open and run:
```sql
INSERT INTO incidents (title, description, incident_type, location, reported_by)
VALUES ('Live demo: tree fall near Katpadi', 'Inserted from pgAdmin', 'TREE_FALL', 'Katpadi main road', 10);
```
Total Incidents goes up and the new incident appears in Recent Incidents, with no page reload.
The green **LIVE** badge shows when the data was last refreshed.

### C. The database enforces the rules
```sql
CALL sp_dispatch_unit(7, 9, 3);    -- refused: unit 9 is already DEPLOYED (one unit, one incident)
CALL sp_dispatch_unit(10, 5, 10);  -- refused: user 10 is a citizen, only coordinators dispatch
UPDATE incident_updates SET note = 'changed' WHERE incident_id = 1;  -- refused: timeline is append-only
```
Try the same busy-unit dispatch on the website: it shows **the same database message**.

`windows/3_LIVE_DEMO.sql` has a ready-made report → verify → dispatch script.

---

## 5. Screenshots

### Public website
| Home: live numbers from PostgreSQL | Safety guides with disaster photos |
|---|---|
| ![Home](docs/screenshots/01-home.png) | ![Safety guides](docs/screenshots/02-safety-guides.png) |
| **Shelters & Safe Zones** | **Report an Issue: 4-step form** |
| ![Shelters](docs/screenshots/03-shelters-light.png) | ![Report form](docs/screenshots/04-report.png) |
| **Sign in (one-click demo accounts)** | **My reports (citizen view)** |
| ![Login](docs/screenshots/15-login.png) | ![My reports](docs/screenshots/16-my-reports.png) |

### Command Center
| Dashboard with LIVE badge | Incidents management |
|---|---|
| ![Dashboard](docs/screenshots/05-command.png) | ![Incidents](docs/screenshots/06-incidents.png) |
| **Incident panel: actions, units, timeline** | **Analytics & Reports** |
| ![Incident panel](docs/screenshots/07-incident-drawer.png) | ![Analytics](docs/screenshots/08-analytics.png) |
| **Response units** | **Zones & Shelters** |
| ![Units](docs/screenshots/09-units.png) | ![Zones](docs/screenshots/10-zones.png) |
| **Dispatches** | **Resources (light mode)** |
| ![Dispatches](docs/screenshots/11-dispatches.png) | ![Resources](docs/screenshots/12-resources-light.png) |
| **Allocations** | **Users & Roles (administrator)** |
| ![Allocations](docs/screenshots/13-allocations.png) | ![Users](docs/screenshots/14-users.png) |

### On a phone
<p align="center">
<img src="docs/screenshots/17-mobile-home.png" width="250" alt="Home on a phone">&nbsp;&nbsp;
<img src="docs/screenshots/18-mobile-command.png" width="250" alt="Command Center on a phone">
</p>

> These screenshots were taken on a machine without internet access to the photo and
> map sites. On your computer, the hero photograph and the street map load as well.

---

## 6. System architecture

![System architecture](docs/architecture/system.png)

| Layer | Technology | What it does |
|---|---|---|
| Website | React 18, TypeScript, Vite, Tailwind CSS, Leaflet (maps), Recharts (charts) | Public site and Command Center; light and dark modes; works on phones; refreshes data every 5 s |
| API | FastAPI, SQLAlchemy 2, Pydantic, PyJWT, Werkzeug | Sign-in, role checks, input checks, REST endpoints, photo uploads, start-up schema check |
| Business rules | PL/pgSQL in PostgreSQL | `sp_dispatch_unit`, `sp_close_incident`, 5 triggers, `fn_stock_status`, `fn_active_incidents`, `fn_response_minutes`, all CHECK and foreign-key constraints |
| Data | PostgreSQL | The 8 original tables, plus 4 additive `app_*` tables |

**How one request works:**
1. The website calls `/api/...` with the signed-in user's token.
2. The API checks the token, re-reads the user's role from the database, and validates the input.
3. In the same transaction, the API sets `dmers.actor_id` (who is acting). It then runs SQL or
   calls a stored procedure.
4. PostgreSQL applies its constraints and triggers. If a rule fails, its message is shown on the
   website (HTTP 409/422).

**Dispatching a unit, step by step:**

![Dispatch sequence](docs/architecture/dispatch.png)

**Incident life cycle:**

![Incident life cycle](docs/architecture/lifecycle.png)

| Status | Set by |
|---|---|
| REPORTED | Anyone signed in (trigger writes timeline entry #1) |
| VERIFIED / REJECTED | Coordinator or administrator (a zone is required to verify) |
| RESPONDING | `sp_dispatch_unit`, when the first unit is sent |
| RESOLVED | Coordinator or administrator, once no unit is still assigned |
| CLOSED | `sp_close_incident` (its cursor releases any units still assigned) |

**Data model:**

![Entity relationship diagram](docs/architecture/erd.png)

The diagram sources are in `docs/architecture/*.mmd` (Mermaid).

---

## 7. Who can do what

| Action | Citizen | Unit lead | Coordinator | Administrator | Enforced by |
|---|:-:|:-:|:-:|:-:|---|
| Report an incident, follow own reports | ✓ | ✓ | ✓ | ✓ | API |
| Open the Command Center | | ✓ | ✓ | ✓ | API |
| Verify / reject / resolve / close | | | ✓ | ✓ | API + `ck_incidents_zone_when_verified`, `sp_close_incident` |
| Dispatch a unit | | | ✓ | | `sp_dispatch_unit` + dispatch-guard trigger |
| Update a dispatch's progress | | own unit | ✓ | ✓ | API + dispatch CHECK constraints |
| Allocate / adjust / withdraw relief | | | ✓ | ✓ | stock trigger |
| Add or restock resources, edit units and zones | | | | ✓ | API + CHECK constraints |
| Manage shelters | | | ✓ | ✓ | API + `app_shelters` constraints |
| Manage users and roles | | | | ✓ | API (at least one administrator must remain) |

---

## 8. What the app adds to the database

The app does not drop, reset or alter any original table, constraint, trigger or procedure. The
only database change is `database/migrations/M001_app_extensions.sql`, which adds four new tables:

| Table | Purpose |
|---|---|
| `app_zone_geo` | Map position of each zone |
| `app_shelters` | Shelters, safe zones and relief camps with capacity |
| `app_incident_attachments` | Index of photos uploaded with reports |
| `app_schema_migrations` | Records that M001 was applied |

The migration is safe to run more than once. To prove nothing original changed:
```
psql -d dmers_course -At -f database/checks/fingerprint.sql > before.txt
(start the API once, or run: python -m app.migrate  inside backend)
psql -d dmers_course -At -f database/checks/fingerprint.sql > after.txt
fc before.txt after.txt          (Windows)   /   diff before.txt after.txt   (Mac/Linux)
```
No differences means every original column, constraint, index, trigger, routine and row is
unchanged. More detail is in `MIGRATION_NOTES.md`.

---

## 9. Troubleshooting

First, double-click **`windows\DIAGNOSE.bat`**. It checks each step in order and prints the fix
for anything that fails: settings → PostgreSQL login → DMERS tables → demo password → API
(port 8765) → website (port 5288).

| What you see | Cause | Fix |
|---|---|---|
| Red banner "Live data unavailable … No answer from the server" | The API is not running | `windows\2_START.bat`; keep the "DMERS API" window open |
| Red banner mentioning **404** | Another program is answering on the API port | `windows\STOP_DMERS.bat`, then `windows\2_START.bat` |
| "password authentication failed" | Wrong `DB_USER` or `DB_PASSWORD` | Edit `backend\.env` |
| "connection refused" | Wrong `DB_PORT`, or PostgreSQL is stopped | Check the port in pgAdmin; start the service in `services.msc` |
| "not the DMERS schema" | Wrong `DB_NAME` | Set it to the database that has the 8 DMERS tables |
| "Port 8765/5288 is already in use" | An old DMERS window is still open | `windows\STOP_DMERS.bat` |
| A different website appears | You opened another project's address | Use **http://localhost:5288** |
| Grey map or no photos | No internet in the browser | Connect to the internet; re-run `python tools\download_photos.py` |

---

## 10. Other ways to run

### Manual (two terminals)
```
# Terminal 1, in the backend folder
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8765

# Terminal 2, in the frontend folder
npm install
npm run dev            # http://localhost:5288 (forwards /api to 127.0.0.1:8765)
```

### Docker (bundled database)
```
copy .env.example .env      # set JWT_SECRET
docker compose up --build   # website http://localhost:5173, API http://localhost:8000/docs
```
On first start, an empty Docker volume loads the original SQL scripts plus M001. To use
your own database instead, set the `DB_*` values in `.env` with `DB_HOST=host.docker.internal`,
then run `docker compose up --build --no-deps backend frontend`.

### Free online hosting
Step-by-step guide: **[DEPLOY.md](DEPLOY.md)**. It uses Neon (database), Render (API, set up from
`render.yaml`) and Vercel (website, `frontend/vercel.json`), with no credit card needed.
`windows\LOAD_CLOUD_DB.bat` loads the tables and demo data into the empty online database.

---

## 11. Tests

```
cd backend
pip install -r requirements-dev.txt
set TEST_ADMIN_URL=postgresql://postgres:<password>@localhost:5433/postgres
pytest -q
```
The tests build a temporary database `dmers_app_test` from the original scripts, then delete it.
They never touch `dmers`, `dmers_db` or `dmers_course`. The 17 tests cover:
* database preservation;
* login with the seeded password hashes;
* the full incident life cycle through the real procedures and triggers;
* role rules, photo upload, analytics and search.

Browser flow (with DMERS running, against a **test copy** of the database):
`set BASE=http://localhost:5288 && node tests_e2e\ui_flow.cjs`.
It covers sign-up → report → still there after refresh → verify → dispatch → allocate → close.

Latest results: `TEST_REPORT.md`.

---

## 12. Project layout
```
backend/app/           FastAPI app (models.py mirrors database/original/01_schema.sql)
backend/tests/         pytest suite (builds its own temporary database)
frontend/src/          React + TypeScript website (pages/public, pages/command)
frontend/public/images Disaster photos (downloaded by tools/download_photos.py)
database/original/     Original DMERS SQL scripts (schema, PL/pgSQL, seed, demos), unchanged
database/migrations/   M001_app_extensions.sql (additive, safe to re-run)
database/checks/       fingerprint.sql (proves nothing original changed)
windows/               1_SETUP, 2_START, STOP_DMERS, DIAGNOSE, 3_LIVE_DEMO.sql, settings template
tools/                 download_photos.py, diagnose.py
docs/                  screenshots, architecture diagrams, photo credits
tests_e2e/             browser flow test (Playwright)
```

Photo credits (all public domain, U.S. Government): `docs/PHOTO_CREDITS.md`.
Map data © OpenStreetMap contributors.
