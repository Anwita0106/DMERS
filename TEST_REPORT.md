# DMERS test report (26 Oct 2026)

Environment: PostgreSQL 16, Python 3.13, Node 22, Chromium (Playwright).

| Check | Result |
|---|---|
| Original package `run_all.sql` loaded (00–07, as in execution_log.txt) | OK |
| M001 applied twice to that database; `fingerprint.sql` before vs after | identical (99 checksums: columns, constraints, indexes, triggers, routines, view, all rows) |
| M001 on a V6-schema database | refused, nothing created |
| Fresh Docker-style init (`database/initdb/10_load_dmers.sh`) | OK: 14 incidents, M001 recorded |
| Backend pytest suite | **17 passed** |
| Frontend `tsc --noEmit` + `vite build` | OK, no type errors |
| Browser flow `tests_e2e/ui_flow.cjs` (sign-up → report wizard + photo → verify → dispatch → allocate → close) | **PASSED**, no page errors |
| 15 pages screenshotted, light/dark, desktop and 390 px phone | no console errors; no horizontal scroll at phone width |

Not tested here: `docker compose build`. Docker Hub was not reachable from the test
machine. `docker compose config` validates, and the init script and the backend's
container paths were tested outside Docker.

Screenshots are in `docs/screenshots/`. Map tiles were blocked in the test browser, so
those maps show markers on a plain background. In a normal browser the street map
appears under them.

## Review-ready fixes (27 Oct 2026)

| Problem seen | Root cause | Fix |
|---|---|---|
| Stats show "-", shelters empty | Website could not reach the API. The Vite proxy targeted `localhost:8000`; on Windows, Node resolves `localhost` to IPv6 `::1` while uvicorn listens on IPv4 `127.0.0.1`. Errors were also silently shown as "-" or "no results". | Proxy now targets `127.0.0.1:8000`; `2_START.bat` starts uvicorn on `127.0.0.1`. A red banner explains any API or database failure; stats show loading skeletons or "Offline". |
| Map "API KEY REQUIRED" | CARTO basemaps now need an API key | OpenStreetMap standard tiles (no key, attributed); dark mode via CSS filter; empty-state message |
| No photographs | Only a placeholder README in `public/images` | 9 public-domain U.S. Government photos (credits in `docs/PHOTO_CREDITS.md`), downloaded by `tools/download_photos.py` (run by `1_SETUP.bat`). If a local file is missing, the site loads it from Wikimedia, then falls back to the illustration. |

Checked here: 17 backend tests passed; TypeScript and production build OK; `/api/health`,
`/api/public/summary`, `/api/public/alerts`, `/api/shelters` and `/api/zones` returned
PostgreSQL data **through the Vite dev proxy** (the same path the Windows start script uses);
the shelters page lists all 8 shelters with working filters and reset; no console errors.

Not checked here: this test machine blocks openstreetmap.org and wikimedia.org, so map tiles
and photos could not be seen loading. On a normal internet connection they load. To check on
your computer: run `python tools/download_photos.py` (it should say "9 photo(s) ready"), and
open the Shelters page (street map visible).

## Fix for "404 Not Found on every /api call" (27 Oct 2026, 00:50)

**Root cause.** The website was running on port 5175. Vite moves to the next free port when 5173
is taken, so older DMERS website windows still held 5173 and 5174. Every `/api` request was
forwarded to port 8000, and the program answering there was **not the DMERS backend**. It
answered `{"detail":"Not Found"}` to everything, including `POST /api/auth/login`. The DMERS
backend could not use the busy port. Reproduced here with a dummy server on port 8000: the
same 404s on every route.

**Fix.**
* The DMERS API now uses its own port, **8765**.
* The website stays on **5173** (`strictPort`) instead of silently moving to another port.
* `2_START.bat` refuses to start if either port is busy. It waits until `/api/health` answers
  `"service":"dmers-api"` before opening the browser.
* `/api/health` identifies the DMERS API and reports the connected database. The red banner
  now tells apart: no server running, 404 (wrong program on the port), 5xx (backend or
  database error) and other codes.
* New `windows\STOP_DMERS.bat` and `windows\DIAGNOSE.bat` (`tools/diagnose.py`).

**Follow-up:** port 5173 on the user's PC was held by another project (SplitPay). DMERS now uses **5288** for the website and **8765** for the API. Verified again with fake servers occupying 5173 and 8000: diagnose ALL CHECKS PASSED, browser flow PASSED on http://localhost:5288.

**Evidence (with the dummy 404 server still running on port 8000):**
* `diagnose.py` reported ALL CHECKS PASSED: settings, PostgreSQL connection, schema (8 tables,
  3 functions, 2 procedures, 5 triggers), demo password hash, API identity, 34 routes, login
  200, and the website proxy.
* Through http://localhost:5173 these returned 200:
  * `/api/health`, `/api/public/summary`, `/api/shelters`, `/api/zones`, `/api/incidents/types`
  * `POST /api/auth/login` with `Dmers@2026`
* A wrong password returned 401 "Incorrect e-mail or password".
* Browser flow passed: sign-up → report wizard with photo → the report is still listed after
  a page refresh → verify → dispatch (Responding) → allocate → close. In PostgreSQL the
  incident row exists, and its 6 `incident_updates` timeline rows were written by the triggers.
