import uuid

import bcrypt
from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.utils.data_loader import get_record, create_record
from app.utils.database import DBUser
from app.schemas.user import UserCreate
from app.utils.dependencies import verify_api_key

router = APIRouter(prefix="/auth", tags=["auth"])

limiter = Limiter(key_func=get_remote_address)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


@router.post("/register")
def register(credentials: UserCreate):
    if get_record(DBUser, user_mail=credentials.user_mail):
        raise HTTPException(status_code=409, detail="User already exists")

    create_record(
        DBUser,
        user_id=str(uuid.uuid4()),
        user_mail=credentials.user_mail,
        user_pass=_hash_password(credentials.password),
    )
    return {"message": "User registered successfully"}


@router.post("/login")
@limiter.limit("30/minute")
def login(request: Request, credentials: UserCreate):
    user = get_record(DBUser, user_mail=credentials.user_mail)
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
