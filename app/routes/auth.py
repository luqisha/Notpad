import uuid

import bcrypt
from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from app.utils.data_loader import load_users, save_users
from app.schemas.user import User, UserCreate

router = APIRouter(tags=["auth"])


def _find_user_by_mail(users: list[User], email: str) -> User | None:
    for user in users:
        if user.user_mail == email:
            return user
    return None


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


@router.post("/auth/register")
def register(credentials: UserCreate):
    try:
        credentials = UserCreate(user_mail=credentials.user_mail, password=credentials.password)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Invalid registration data")

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


@router.post("/auth/login")
def login(request: Request, credentials: UserCreate):
    try:
        credentials = UserCreate(user_mail=credentials.user_mail, password=credentials.password)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Invalid login data")

    users = load_users()
    user = _find_user_by_mail(users, credentials.user_mail)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not _verify_password(credentials.password, user.user_pass):
        raise HTTPException(status_code=401, detail="Invalid password")

    request.session["user_id"] = user.user_id
    return {"message": "Login successful", "user_id": user.user_id}


@router.post("/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out successfully"}
