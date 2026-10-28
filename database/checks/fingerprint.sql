-- =====================================================================================
-- DMERS | fingerprint.sql
-- Read-only. Prints one checksum per original original database objects so you can prove that the
-- app migration (M001) changed nothing in the original design.
--
--   psql -d <your_db> -At -f fingerprint.sql > before.txt
--   (apply database/migrations/M001_app_extensions.sql, or start the backend)
--   psql -d <your_db> -At -f fingerprint.sql > after.txt
--   diff before.txt after.txt          -- no output means nothing original changed
--
-- Covers: column definitions, constraints, indexes, triggers, function and procedure
-- bodies, the v_zone_situation view (if present) and the full contents of the 8 tables.
-- =====================================================================================
\set QUIET on
\pset footer off
SET client_min_messages = warning;
SET TIME ZONE 'UTC';            -- timestamps print the same way on every run

-- 1. Column definitions of the eight original tables
SELECT 'columns|' || table_name || '|' || md5(string_agg(
         column_name || ':' || data_type || ':' || coalesce(character_maximum_length::text, '')
         || ':' || is_nullable || ':' || coalesce(column_default, '') || ':' || is_identity,
         ',' ORDER BY ordinal_position))
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'zones', 'incidents', 'response_units', 'resources',
                     'incident_updates', 'dispatches', 'resource_allocations')
GROUP BY table_name ORDER BY table_name;

-- 2. Constraints (primary, foreign, unique, check) on the original tables
SELECT 'constraint|' || conrelid::regclass::text || '|' || conname || '|'
       || md5(pg_get_constraintdef(oid))
FROM pg_constraint
WHERE conrelid::regclass::text IN ('users', 'zones', 'incidents', 'response_units', 'resources',
                                   'incident_updates', 'dispatches', 'resource_allocations')
ORDER BY 1;

-- 3. Indexes on the original tables
SELECT 'index|' || indexname || '|' || md5(indexdef)
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('users', 'zones', 'incidents', 'response_units', 'resources',
                    'incident_updates', 'dispatches', 'resource_allocations')
ORDER BY 1;

-- 4. Triggers on the original tables
SELECT 'trigger|' || tgname || '|' || md5(pg_get_triggerdef(oid))
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgrelid::regclass::text IN ('users', 'zones', 'incidents', 'response_units', 'resources',
                                  'incident_updates', 'dispatches', 'resource_allocations')
ORDER BY 1;

-- 5. Function and procedure bodies of the DMERS database design
SELECT 'routine|' || p.proname || '|' || md5(pg_get_functiondef(p.oid))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('fn_stock_status', 'fn_active_incidents', 'fn_response_minutes',
                    'sp_dispatch_unit', 'sp_close_incident', 'trg_fn_incident_timeline',
                    'trg_fn_touch_updated_at', 'trg_fn_dispatch_guard',
                    'trg_fn_allocation_stock', 'trg_fn_timeline_append_only')
ORDER BY 1;

-- 6. The zone situation view from 05_queries.sql (only if it was created)
SELECT 'view|' || viewname || '|' || md5(definition)
FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_zone_situation';

-- 7. Data: row count and checksum of every row of each original table
SELECT 'data|users|' || count(*) || '|' || coalesce(md5(string_agg(t::text, '' ORDER BY id)), '-') FROM users t;
SELECT 'data|zones|' || count(*) || '|' || coalesce(md5(string_agg(t::text, '' ORDER BY id)), '-') FROM zones t;
SELECT 'data|incidents|' || count(*) || '|' || coalesce(md5(string_agg(t::text, '' ORDER BY id)), '-') FROM incidents t;
SELECT 'data|response_units|' || count(*) || '|' || coalesce(md5(string_agg(t::text, '' ORDER BY id)), '-') FROM response_units t;
SELECT 'data|resources|' || count(*) || '|' || coalesce(md5(string_agg(t::text, '' ORDER BY id)), '-') FROM resources t;
SELECT 'data|incident_updates|' || count(*) || '|' || coalesce(md5(string_agg(t::text, '' ORDER BY incident_id, update_no)), '-') FROM incident_updates t;
SELECT 'data|dispatches|' || count(*) || '|' || coalesce(md5(string_agg(t::text, '' ORDER BY incident_id, unit_id)), '-') FROM dispatches t;
SELECT 'data|resource_allocations|' || count(*) || '|' || coalesce(md5(string_agg(t::text, '' ORDER BY incident_id, resource_id)), '-') FROM resource_allocations t;
