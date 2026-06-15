import os
from typing import Optional

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import APIKeyHeader


api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: str = Security(api_key_header)) -> str:
    expected_key = os.environ.get("API_KEY")
    if not expected_key:
        raise HTTPException(status_code=500, detail="API key not configured")
    if not api_key:
        raise HTTPException(status_code=403, detail="API Key header missing")
    if api_key != expected_key:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key


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
