import uuid
from pathlib import Path

import bcrypt
from fastapi import APIRouter, Request

from app.utils.storage import read_file, write_file

_USERS_FILE = Path(__file__).resolve().parent.parent / "data" / "user.json"

router = APIRouter(tags=["auth"])


def _find_user_by_mail(users: list, email: str):
    for user in users:
        if user["user_mail"] == email:
            return user
    return None


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


@router.post("/auth/register")
def register(usermail: str, password: str):
    users = read_file(_USERS_FILE)

    if _find_user_by_mail(users, usermail):
        return {"message": "User already exists"}

    users.append(
        {
            "user_id": str(uuid.uuid4()),
            "user_mail": usermail,
            "user_pass": _hash_password(password),
        }
    )
    write_file(_USERS_FILE, users)
    return {"message": "User registered successfully"}


@router.post("/auth/login")
def login(request: Request, usermail: str, password: str):
    users = read_file(_USERS_FILE)
    user = _find_user_by_mail(users, usermail)
    if not user:
        return {"message": "User not found"}

    if not _verify_password(password, user["user_pass"]):
        return {"message": "Invalid password"}

    request.session["user_id"] = user["user_id"]
    return {"message": "Login successful", "user_id": user["user_id"]}


@router.post("/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out successfully"}
