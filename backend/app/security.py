"""Sign-in, tokens and role checks.

Passwords: the DMERS seed stores Werkzeug scrypt hashes (BR-01, hash only), and the
original Flask app used Werkzeug too, so the API verifies and creates hashes with Werkzeug.
Every seeded account keeps working with its existing hash.
"""
from datetime import datetime, timedelta, timezone
from typing import Iterable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from .config import settings
from .db import get_db
from .models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
ALGORITHM = "HS256"

STAFF = ("COORDINATOR", "UNIT_LEAD", "ADMINISTRATOR")


def hash_password(password: str) -> str:
    return generate_password_hash(password)          # scrypt, same format as the seed


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return check_password_hash(password_hash, password)
    except (ValueError, TypeError):                    # unknown or malformed hash
        return False


def create_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user.id), "role": user.account_type, "iat": now,
               "exp": now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def _unauthorised(detail: str = "Please sign in") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail=detail,
                         headers={"WWW-Authenticate": "Bearer"})


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise _unauthorised()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _unauthorised("Your session has expired, please sign in again")
    user = db.get(User, user_id)
    if user is None:
        raise _unauthorised()
    return user                                         # role is always re-read from the DB


def get_optional_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User | None:
    if not token:
        return None
    try:
        return get_current_user(token, db)
    except HTTPException:
        return None


def require_roles(*roles: str):
    allowed: Iterable[str] = roles

    def dep(user: User = Depends(get_current_user)) -> User:
        if user.account_type not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                detail=f"This action needs one of these roles: {', '.join(allowed)}")
        return user
    return dep


require_staff = require_roles(*STAFF)


def find_user_by_email(db: Session, email: str) -> User | None:
    from sqlalchemy import func
    return db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))
