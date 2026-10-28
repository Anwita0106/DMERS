#!/bin/sh
# Runs ONLY when the Docker volume is empty (first start of a brand-new database).
# It never runs against an existing database. Loads the original original SQL scripts
# (schema, PL/pgSQL, seed) unchanged, then the additive app migration (M001).
set -e
for f in /dmers-sql/original/01_schema.sql /dmers-sql/original/02_plpgsql.sql \
         /dmers-sql/original/03_seed_data.sql /dmers-sql/migrations/M001_app_extensions.sql; do
  echo "DMERS init: $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done
