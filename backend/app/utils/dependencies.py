from typing import Optional

from fastapi import Request


def get_logged_in_user_id(request: Request) -> Optional[str]:
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    return str(user_id)
