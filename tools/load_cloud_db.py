"""Load the DMERS database into an EMPTY online PostgreSQL database (Neon, Supabase, Render...).

    python tools/load_cloud_db.py "postgresql://user:pass@host/dbname?sslmode=require"

Runs database/original/01_schema.sql, 02_plpgsql.sql, 03_seed_data.sql and then the additive
app migration (database/migrations/M*.sql). It refuses to run if the DMERS tables already
exist, so it can never overwrite data. To copy your OWN local data instead, see DEPLOY.md.
"""
import sys
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = [ROOT / "database" / "original" / f for f in ("01_schema.sql", "02_plpgsql.sql", "03_seed_data.sql")]
SCRIPTS += sorted((ROOT / "database" / "migrations").glob("M*.sql"))


def sql_of(path: Path) -> str:
    # psql meta-commands (lines starting with a backslash) are not SQL; skip them
    return "\n".join(l for l in path.read_text(encoding="utf-8").splitlines() if not l.lstrip().startswith("\\"))


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1].startswith(("postgres://", "postgresql://")):
        print(__doc__)
        return 1
    conn = psycopg2.connect(sys.argv[1])
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(), version()")
        db, ver = cur.fetchone()
        print(f"Connected to database '{db}' ({ver.split(',')[0]})")
        cur.execute("SELECT to_regclass('public.incidents')")
        if cur.fetchone()[0]:
            print("The DMERS tables already exist here - nothing was changed.")
            return 0
        for path in SCRIPTS:
            print(f"  running {path.name} ...", flush=True)
            cur.execute(sql_of(path))
        cur.execute("SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM incidents), (SELECT count(*) FROM app_shelters)")
        u, i, s = cur.fetchone()
    conn.close()
    print(f"Done: {u} users, {i} incidents, {s} shelters loaded. Demo password for all accounts: Dmers@2026")
    return 0


if __name__ == "__main__":
    sys.exit(main())
