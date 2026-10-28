# Reconciliation with the old V6 app, and migration notes

## 1. What was out of line in V6

V6's `db_init/01_schema.sql` and `backend/models.py` described a different database from
the original SQL package. The V6 API could not read the DMERS data. Its main gaps:

| Area | Old V6 app | DMERS (source of truth) | Now |
|---|---|---|---|
| users | `username`, `role` (RESPONDER/ADMIN), bcrypt | `full_name`, `email`, `account_type` (CITIZEN/COORDINATOR/UNIT_LEAD/ADMINISTRATOR), Werkzeug scrypt | Follows DMERS. Login by e-mail; Werkzeug hashes verified and created. |
| zones | `name`, `coordinates` | `zone_name` UNIQUE, `district`, `state`, `risk_level` LOW/MEDIUM/HIGH | Follows DMERS. Coordinates are in the new `app_zone_geo`. |
| incidents | `severity INTEGER`, `reporter_id`, lat/lng, `description NOT NULL` | `severity` LOW/MODERATE/HIGH/CRITICAL, `incident_type`, `location` text, `reported_by`, 6-state status, zone required once verified | Follows DMERS |
| response_units | `name`, `status` | `unit_name`, `unit_type`, `contact_phone`, `personnel_count`, `availability_status`, `zone_id`, `lead_user_id` | Follows DMERS |
| resources | `name`, `total_quantity`, `available_quantity` | `resource_name`, `category`, `unit_of_measure`, `quantity_available`, `reorder_level` (+ `fn_stock_status`) | Follows DMERS |
| incident_updates | surrogate `id`, free text | weak entity PK (`incident_id`, `update_no`), status transition, append-only, written by trigger | Read-only in the API (the triggers write it) |
| dispatches / allocations | surrogate `id`, `ON DELETE CASCADE` | composite PKs, `ON DELETE RESTRICT`, dispatch timing CHECKs, one active dispatch per unit | Follows DMERS. Created through `sp_dispatch_unit` / trigger T4. |
| Business rules | none (plain inserts) | 3 functions, 2 procedures (one with a cursor), 5 triggers | Called by the API |
| Frontend | `Placeholder.tsx` empty (build failed), generic tables, `admin/admin123` hint | – | Rebuilt |

## 2. Changes the app makes to a database

Only `database/migrations/M001_app_extensions.sql` changes a database, and it only adds.

* **Guard.** It stops if the eight tables, `users.account_type` or the procedures are
  missing (for example on a V6 database). Nothing is created in that case.
* **New tables:**
  * `app_schema_migrations`: which migrations have run.
  * `app_zone_geo` (zone_id PK/FK → zones `ON DELETE CASCADE`): map centre and radius of each zone.
  * `app_shelters` (FK → zones `ON DELETE CASCADE`): shelters, safe zones and relief camps,
    with capacity and occupancy CHECKs.
  * `app_incident_attachments` (FK → incidents `ON DELETE CASCADE`, users `ON DELETE SET NULL`):
    the index of uploaded photos.
* **Reference rows:**
  * coordinates for the 12 original zones, matched by `zone_name` and added only if missing;
  * 8 demonstration shelters, added only when `app_shelters` is empty.
* **Why these foreign keys.** Each FK uses `CASCADE` or `SET NULL`, so none of them can block
  a DELETE that the original design allows. Deleting a rejected incident (04_dml_demo D5)
  or a zone with no incidents still works exactly as before.
* **Idempotent.** Every object uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`, and the
  migration is recorded in `app_schema_migrations`.

Verified here on a database built with `run_all.sql` (all of 00–07). The fingerprint was
identical before and after two runs: 99 checksums covering columns, constraints, indexes,
triggers, routines, the view and the rows of all 8 tables.

## 3. How the API uses the original rules

| Operation | SQL used |
|---|---|
| Report incident | `INSERT INTO incidents …` → T1 writes timeline entry 1 |
| Verify / reject / resolve | `UPDATE incidents SET status …` with `set_config('dmers.actor_id' / 'dmers.note', …, true)` → T1 + T2 |
| Dispatch | `CALL sp_dispatch_unit(incident, unit, user)` → T3 guard, unit DEPLOYED, incident RESPONDING |
| Dispatch progress | `UPDATE dispatches` (`arrived_at` / `cleared_at` as in the seed); the unit becomes AVAILABLE when cleared |
| Close | `CALL sp_close_incident(incident, user, note)` → cursor releases units, RESOLVED → CLOSED |
| Allocate / adjust / withdraw | `INSERT … ON CONFLICT DO UPDATE` / `UPDATE` / `DELETE` on resource_allocations → T4 moves stock and writes the timeline |
| Stock status, zone load, response time | `fn_stock_status`, `fn_active_incidents`, `fn_response_minutes` |

When a constraint or trigger rejects a change, the API returns HTTP 409/422 with the
database's message (for example *"Unit 9 is DEPLOYED, not AVAILABLE"*).
