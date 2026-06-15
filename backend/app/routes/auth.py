import uuid

import bcrypt
from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.utils.data_loader import load_users, save_users
from app.schemas.user import User, UserCreate
from app.utils.dependencies import verify_api_key

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(verify_api_key)])

limiter = Limiter(key_func=get_remote_address)


def _find_user_by_mail(users: list[User], email: str) -> Optional[User]:
    for user in users:
        if user.user_mail == email:
            return user
    return None


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


@router.post("/register")
def register(credentials: UserCreate):
    users = load_users()

    if _find_user_by_mail(users, credentials.user_mail):
        raise HTTPException(status_code=409, detail="User already exists")

    users.append(
        User(
            user_id=str(uuid.uuid4()),
            user_mail=credentials.user_mail,
            user_pass=_hash_password(credentials.password),
        )
    )
    save_users(users)
    return {"message": "User registered successfully"}


@router.post("/login")
@limiter.limit("30/minute")
def login(request: Request, credentials: UserCreate):
    users = load_users()
    user = _find_user_by_mail(users, credentials.user_mail)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not _verify_password(credentials.password, user.user_pass):
        raise HTTPException(status_code=401, detail="Invalid password")

    request.session["user_id"] = user.user_id
    return {"message": "Login successful", "user_id": user.user_id}


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out successfully"}
