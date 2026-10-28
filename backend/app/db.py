"""Database engine, sessions, and the two transaction settings read by the DMERS triggers."""
from typing import Iterator, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"options": f"-c timezone={settings.APP_TIMEZONE}"},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def set_actor(db: Session, user_id: int, note: Optional[str] = None) -> None:
    """Set dmers.actor_id / dmers.note for the current transaction only.

    02_plpgsql.sql's timeline trigger (T1) and stock trigger (T4) read these settings to
    record who made a change and the text of the next timeline entry. is_local = true is
    the same as SET LOCAL, so the values disappear at COMMIT or ROLLBACK.
    """
    db.execute(
        text("SELECT set_config('dmers.actor_id', :actor, true), set_config('dmers.note', :note, true)"),
        {"actor": str(user_id), "note": (note or "")[:200]},
    )
