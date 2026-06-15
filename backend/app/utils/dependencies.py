from typing import Optional

from fastapi import Depends, HTTPException, Request


def get_logged_in_user_id(request: Request) -> Optional[str]:
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    return str(user_id)


def require_user_id(request: Request) -> str:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    return str(user_id)
