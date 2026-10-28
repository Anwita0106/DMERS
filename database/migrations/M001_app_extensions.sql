-- =====================================================================================
-- DMERS | M001_app_extensions.sql
-- ADDITIVE ONLY. Safe to run any number of times on an existing DMERS database.
--
-- What it does
--   * Checks that the DMERS schema (01_schema.sql + 02_plpgsql.sql) is present and
--     stops with an error if it is not (for example on the old V6 "username" schema).
--   * Creates four NEW tables, all prefixed app_, that the web app needs and that the
--     DMERS database design does not have:
--       app_schema_migrations     which app migrations have been applied
--       app_zone_geo              map coordinates for each zone (1:1 with zones)
--       app_shelters              relief shelters / safe zones (N:1 with zones)
--       app_incident_attachments  photos uploaded with an incident report (N:1 with incidents)
--   * Adds map coordinates for the 12 original zones and a few demonstration shelters,
--     matched by zone_name, only where they are missing.
--
-- What it never does
--   * No DROP, TRUNCATE, ALTER or DELETE on users, zones, incidents, response_units,
--     resources, incident_updates, dispatches or resource_allocations.
--   * No change to any constraint, index, trigger, function, procedure or view of
--     01_schema.sql / 02_plpgsql.sql / 05_queries.sql.
-- =====================================================================================
BEGIN;
SET LOCAL client_min_messages = warning;

-- -------------------------------------------------------------------------------------
-- 0. Guard: the DMERS schema must already exist
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(t, ', ') INTO v_missing
  FROM unnest(ARRAY['users', 'zones', 'incidents', 'response_units', 'resources',
                    'incident_updates', 'dispatches', 'resource_allocations']) AS t
  WHERE to_regclass('public.' || t) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'DMERS: DMERS tables missing (%). Load database/original/01_schema.sql '
                    'and 02_plpgsql.sql first.', v_missing;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'users'
                   AND column_name = 'account_type') THEN
    RAISE EXCEPTION 'DMERS: table "users" does not follow the DMERS database design (no account_type '
                    'column). This looks like the V6 schema; point DATABASE_URL at the DMERS database.';
  END IF;

  IF to_regprocedure('sp_dispatch_unit(integer,integer,integer)') IS NULL
     OR to_regprocedure('sp_close_incident(integer,integer,character varying)') IS NULL
     OR to_regprocedure('fn_stock_status(integer)') IS NULL THEN
    RAISE EXCEPTION 'DMERS: DMERS functions/procedures missing. Load database/original/02_plpgsql.sql first.';
  END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- 1. Migration log
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_schema_migrations (
  version     VARCHAR(40) CONSTRAINT pk_app_schema_migrations PRIMARY KEY,
  description VARCHAR(200) NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------------------
-- 2. Zone coordinates (1:1 extension of zones; zones itself is not altered)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_zone_geo (
  zone_id    INTEGER
             CONSTRAINT pk_app_zone_geo PRIMARY KEY
             CONSTRAINT fk_app_zone_geo_zone REFERENCES zones (id) ON DELETE CASCADE,
  latitude   NUMERIC(9, 6) NOT NULL
             CONSTRAINT ck_app_zone_geo_lat CHECK (latitude BETWEEN -90 AND 90),
  longitude  NUMERIC(9, 6) NOT NULL
             CONSTRAINT ck_app_zone_geo_lng CHECK (longitude BETWEEN -180 AND 180),
  radius_km  NUMERIC(5, 2) NOT NULL DEFAULT 3
             CONSTRAINT ck_app_zone_geo_radius CHECK (radius_km > 0)
);

-- -------------------------------------------------------------------------------------
-- 3. Shelters and safe zones
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_shelters (
  id                INTEGER GENERATED ALWAYS AS IDENTITY
                    CONSTRAINT pk_app_shelters PRIMARY KEY,
  shelter_name      VARCHAR(80) NOT NULL
                    CONSTRAINT uq_app_shelters_name UNIQUE,
  shelter_type      VARCHAR(15) NOT NULL DEFAULT 'SHELTER'
    CONSTRAINT ck_app_shelters_type
      CHECK (shelter_type IN ('SHELTER', 'SAFE_ZONE', 'RELIEF_CAMP')),
  facility_type     VARCHAR(15) NOT NULL DEFAULT 'COMMUNITY'
    CONSTRAINT ck_app_shelters_facility
      CHECK (facility_type IN ('SCHOOL', 'COLLEGE', 'COMMUNITY', 'GOVERNMENT', 'RELIGIOUS', 'OPEN_GROUND')),
  zone_id           INTEGER NOT NULL
                    CONSTRAINT fk_app_shelters_zone REFERENCES zones (id) ON DELETE CASCADE,  -- never blocks a zone delete the original design allows
  address           VARCHAR(150) NOT NULL,
  capacity          INTEGER NOT NULL
                    CONSTRAINT ck_app_shelters_capacity CHECK (capacity > 0),
  current_occupancy INTEGER NOT NULL DEFAULT 0
                    CONSTRAINT ck_app_shelters_occupancy CHECK (current_occupancy >= 0),
  status            VARCHAR(8) NOT NULL DEFAULT 'OPEN'
    CONSTRAINT ck_app_shelters_status CHECK (status IN ('OPEN', 'FULL', 'CLOSED')),
  open_24x7         BOOLEAN NOT NULL DEFAULT true,
  contact_phone     VARCHAR(10)
    CONSTRAINT ck_app_shelters_phone CHECK (contact_phone ~ '^[6-9][0-9]{9}$'),
  amenities         VARCHAR(200),
  latitude          NUMERIC(9, 6) NOT NULL
                    CONSTRAINT ck_app_shelters_lat CHECK (latitude BETWEEN -90 AND 90),
  longitude         NUMERIC(9, 6) NOT NULL
                    CONSTRAINT ck_app_shelters_lng CHECK (longitude BETWEEN -180 AND 180),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_app_shelters_within_capacity CHECK (current_occupancy <= capacity)
);
CREATE INDEX IF NOT EXISTS ix_app_shelters_zone ON app_shelters (zone_id);

-- -------------------------------------------------------------------------------------
-- 4. Photos attached to an incident report (files live on disk; this is the index)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_incident_attachments (
  id           INTEGER GENERATED ALWAYS AS IDENTITY
               CONSTRAINT pk_app_incident_attachments PRIMARY KEY,
  incident_id  INTEGER NOT NULL
               CONSTRAINT fk_app_attachments_incident REFERENCES incidents (id) ON DELETE CASCADE,
  file_name    VARCHAR(120) NOT NULL,
  content_type VARCHAR(40) NOT NULL
    CONSTRAINT ck_app_attachments_type CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes   INTEGER NOT NULL
    CONSTRAINT ck_app_attachments_size CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  storage_key  VARCHAR(80) NOT NULL CONSTRAINT uq_app_attachments_key UNIQUE,
  uploaded_by  INTEGER
               CONSTRAINT fk_app_attachments_user REFERENCES users (id) ON DELETE SET NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_app_attachments_incident ON app_incident_attachments (incident_id);

-- -------------------------------------------------------------------------------------
-- 5. Reference data, only where missing (matched by zone_name, never by id)
-- -------------------------------------------------------------------------------------
INSERT INTO app_zone_geo (zone_id, latitude, longitude, radius_km)
SELECT z.id, g.lat, g.lng, g.r
FROM (VALUES
  ('Vellore Town', 12.916500, 79.132500, 3.0), ('Katpadi', 12.969200, 79.145900, 3.5),
  ('Sathuvachari', 12.940600, 79.160600, 2.5), ('Gandhi Nagar', 12.952000, 79.137000, 2.0),
  ('Gudiyatham', 12.944600, 78.872700, 4.0),   ('Pernambut', 12.938700, 78.717600, 3.0),
  ('Anaicut', 12.876000, 79.040000, 4.0),      ('Arcot', 12.906300, 79.319400, 3.0),
  ('Walajapet', 12.925100, 79.366400, 2.5),    ('Ranipet', 12.924900, 79.333100, 3.0),
  ('Ambur', 12.791600, 78.716600, 3.5),        ('Vaniyambadi', 12.682400, 78.620400, 3.5)
) AS g (zone_name, lat, lng, r)
JOIN zones z ON z.zone_name = g.zone_name
ON CONFLICT (zone_id) DO NOTHING;

-- Demonstration shelters are added only to a database that has no shelters yet
INSERT INTO app_shelters (shelter_name, shelter_type, facility_type, zone_id, address, capacity,
                          current_occupancy, status, open_24x7, contact_phone, amenities, latitude, longitude)
SELECT s.name, s.stype, s.ftype, z.id, s.addr, s.cap, s.occ, s.status, s.h24, s.phone, s.amen, s.lat, s.lng
FROM (VALUES
  ('VIT Campus Shelter', 'SHELTER', 'COLLEGE', 'Katpadi', 'Tiruvalam Road, Katpadi', 500, 200, 'OPEN', true,
   '9000020101', 'Beds, drinking water, medical room, power backup', 12.969900, 79.155900),
  ('Government High School Shelter', 'SHELTER', 'SCHOOL', 'Vellore Town', 'Officers Line, Vellore', 300, 120, 'OPEN', true,
   '9000020102', 'Classrooms, toilets, kitchen', 12.922100, 79.133900),
  ('Sathuvachari Community Hall', 'SHELTER', 'COMMUNITY', 'Sathuvachari', 'Phase II, Sathuvachari', 400, 150, 'OPEN', true,
   '9000020103', 'Hall, kitchen, drinking water', 12.937400, 79.164800),
  ('Fort Grounds Safe Zone', 'SAFE_ZONE', 'OPEN_GROUND', 'Vellore Town', 'Near Vellore Fort', 2000, 0, 'OPEN', true,
   NULL, 'Open assembly ground on high land', 12.920700, 79.129400),
  ('Gudiyatham Relief Camp', 'RELIEF_CAMP', 'GOVERNMENT', 'Gudiyatham', 'Taluk Office Road, Gudiyatham', 350, 350, 'FULL', true,
   '9000020105', 'Tents, food distribution, first aid', 12.947500, 78.869300),
  ('Ranipet Municipal School Shelter', 'SHELTER', 'SCHOOL', 'Ranipet', 'Bharathi Nagar, Ranipet', 250, 40, 'OPEN', false,
   '9000020106', 'Classrooms, toilets', 12.928800, 79.330000),
  ('Ambur Marriage Hall Shelter', 'SHELTER', 'COMMUNITY', 'Ambur', 'Bypass Road, Ambur', 300, 0, 'CLOSED', false,
   '9000020107', 'Hall, kitchen', 12.788200, 78.720500),
  ('Anaicut Panchayat Safe Zone', 'SAFE_ZONE', 'GOVERNMENT', 'Anaicut', 'Panchayat Office, Anaicut', 600, 30, 'OPEN', true,
   NULL, 'Raised ground, panchayat building', 12.879600, 79.036500)
) AS s (name, stype, ftype, zone_name, addr, cap, occ, status, h24, phone, amen, lat, lng)
JOIN zones z ON z.zone_name = s.zone_name
WHERE NOT EXISTS (SELECT 1 FROM app_shelters)
ON CONFLICT (shelter_name) DO NOTHING;

INSERT INTO app_schema_migrations (version, description)
VALUES ('M001', 'App extensions: zone coordinates, shelters, incident photo attachments')
ON CONFLICT (version) DO NOTHING;

COMMIT;
