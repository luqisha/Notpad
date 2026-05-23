from fastapi import APIRouter

from app.data.user import USERS

router = APIRouter(tags=["auth"])


def _find_user_by_mail(email: str):
    for user in USERS:
        if user["user_mail"] == email:
            return user
    return None


def _next_user_id() -> str:
    nums = [int(u["user_id"][1:]) for u in USERS if u["user_id"].startswith("u")]
    return f"u{max(nums, default=0) + 1}"


@router.post("/auth/register")
def register(usermail: str, password: str):
    if _find_user_by_mail(usermail):
        return {"message": "User already exists"}

    USERS.append(
        {
            "user_id": _next_user_id(),
            "user_mail": usermail,
            "user_pass": password,
        }
    )
    return {"message": "User registered successfully"}


@router.post("/auth/login")
def login(usermail: str, password: str):
    user = _find_user_by_mail(usermail)
    if not user:
        return {"message": "User not found"}

    if user["user_pass"] != password:
        return {"message": "Invalid password"}

    return {"message": "Login successful", "user_id": user["user_id"]}
