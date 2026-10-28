-- Run in pgAdmin (Query Tool on your DMERS database) while the DMERS dashboard is open.
-- Each statement goes through your own triggers; the screen updates within ~5 seconds.

-- 1. A citizen (user 10) reports a new incident  -> appears in Recent Incidents
INSERT INTO incidents (title, description, incident_type, location, reported_by)
VALUES ('Live demo: tree fall on Katpadi main road', 'Reported from pgAdmin', 'TREE_FALL',
        'Katpadi main road', 10)
RETURNING id;

-- 2. A coordinator (user 3) verifies it  -> Active Incidents goes up, pin appears on the map
--    (replace 999 with the id returned above)
BEGIN;
SET LOCAL dmers.actor_id = '3';
UPDATE incidents SET status = 'VERIFIED', zone_id = 2, severity = 'HIGH' WHERE id = 999;
COMMIT;

-- 3. Dispatch an AVAILABLE unit through your procedure  -> status becomes RESPONDING
CALL sp_dispatch_unit(999, 7, 3);   -- unit 7 = Katpadi Police Patrol, user 3 = coordinator
