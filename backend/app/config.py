"""Runtime settings, read from environment variables (see .env.example)."""
import os
import secrets
import logging
from pathlib import Path

log = logging.getLogger("dmers")


def _load_env_file() -> None:
    """Read KEY=VALUE lines from backend/.env or the project .env (real environment wins)."""
    root = Path(__file__).resolve().parents[1]
    for f in (root / ".env", root.parent / ".env"):
        if f.is_file():
            for line in f.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            break


_load_env_file()


def _database_url() -> str:
    """DATABASE_URL, or one built from DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.

    The separate form is easier when the password contains @, : or / (they are escaped here).
    """
    if os.getenv("DB_NAME"):
        from sqlalchemy.engine import URL
        return URL.create("postgresql+psycopg2", username=os.getenv("DB_USER", "postgres"),
                          password=os.getenv("DB_PASSWORD", ""), host=os.getenv("DB_HOST", "localhost"),
                          port=int(os.getenv("DB_PORT", "5432")), database=os.getenv("DB_NAME")
                          ).render_as_string(hide_password=False)
    return os.getenv("DATABASE_URL", "postgresql://dmers:dmers@localhost:5433/dmers")


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    # Points at the DMERS database. Default matches the original package README
    # (Docker Compose Postgres on host port 5433, user dmers, application database dmers).
    DATABASE_URL: str = _database_url()

    # Session time zone for the database connection. The seed data is in Asia/Kolkata,
    # and day-by-day analytics are grouped by this zone.
    APP_TIMEZONE: str = os.getenv("APP_TIMEZONE", "Asia/Kolkata")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

    # Apply database/migrations/*.sql (additive only) when the API starts.
    AUTO_MIGRATE: bool = _bool("DMERS_AUTO_MIGRATE", True)
    MIGRATIONS_DIR: Path = Path(os.getenv(
        "DMERS_MIGRATIONS_DIR",
        str(Path(__file__).resolve().parents[2] / "database" / "migrations")))

    UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", str(Path(__file__).resolve().parents[1] / "uploads")))
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
    MAX_ATTACHMENTS_PER_INCIDENT: int = 5

    CORS_ORIGINS: list[str] = [o.strip() for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5288,http://127.0.0.1:5288").split(",") if o.strip()]
    # Optional pattern of extra allowed website origins, e.g. https://.*\.vercel\.app for online hosting
    CORS_ORIGIN_REGEX: str | None = os.getenv("CORS_ORIGIN_REGEX") or None


settings = Settings()

if not settings.JWT_SECRET:
    settings.JWT_SECRET = secrets.token_urlsafe(48)
    log.warning("JWT_SECRET is not set; using a random key (sign-ins end when the API restarts).")
