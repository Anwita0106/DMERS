from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import PasswordChangeIn, RegisterIn
from ..security import (create_token, find_user_by_email, get_current_user, hash_password,
                        verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_out(u: User) -> dict:
    return {"id": u.id, "full_name": u.full_name, "email": u.email,
            "account_type": u.account_type, "created_at": u.created_at}


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 password form (same as V6): `username` is the account e-mail."""
    user = find_user_by_email(db, form.username)
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Incorrect e-mail or password")
    return {"access_token": create_token(user), "token_type": "bearer", "user": user_out(user)}


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    """Self sign-up always creates a CITIZEN account (the column default)."""
    if find_user_by_email(db, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="An account with this e-mail already exists")
    new_id = db.execute(text(
        "INSERT INTO users (full_name, email, password_hash) VALUES (:n, :e, :h) RETURNING id"),
        {"n": body.full_name, "e": body.email.lower(), "h": hash_password(body.password)}).scalar()
    db.commit()
    user = db.get(User, new_id)
    return {"access_token": create_token(user), "token_type": "bearer", "user": user_out(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.post("/password")
def change_password(body: PasswordChangeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    db.execute(text("UPDATE users SET password_hash = :h WHERE id = :id"),
               {"h": hash_password(body.new_password), "id": user.id})
    db.commit()
    return {"ok": True}
