# Notpad — Restructuring TODO

## ~~1. Proper HTTP Status Codes~~ DONE

All routes use `HTTPException` with proper codes:
- 401 → not logged in, invalid password
- 404 → user/note not found
- 409 → user already exists
- 400 → no fields to update, invalid data

---

## 2. Auth Dependency via `Depends()` (High Priority) — PARTIAL

`dependencies.py` exists with `get_logged_in_user_id` but returns `None` instead of raising 401.
Routes call it manually and check the result — not used as a proper `Depends()` param.

**File:** `app/utils/dependencies.py`

**What's needed:** Change to raise 401 directly and wire via `Depends()`:
```python
from fastapi import Depends, HTTPException, Request

def require_user_id(request: Request) -> str:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    return str(user_id)
```
Then in routes: `def create_note(user_id: str = Depends(require_user_id), ...):`

---

## ~~3. Move Credentials to Request Body~~ DONE

`auth.py` uses `credentials: UserCreate` — password in request body, not URL.

---

## ~~4. Move Note Data to Request Body~~ DONE

`NoteCreate` and `NoteUpdate` schemas exist in `schemas/note.py` and are used in `routes/notes.py`.

---

## 5. Deduplicate `_find_note_by_id` (Still Open)

Same helper still exists in two files with identical signatures:
- `routes/notes.py:72`
- `routes/group.py:23`

**Fix:** Move to `data_loader.py` as single function:
```python
def find_note_by_id(notes: list[Note], note_id: str, user_id: str) -> Note | None:
    return next((n for n in notes if n.note_id == note_id and n.user_id == user_id), None)
```
Import from `data_loader` in both route files.

---

## ~~6. Stub Endpoints~~ DONE

`group.py` fully implemented with CRUD + note-group mappings.
Media endpoints (images/voices) implemented in `routes/notes.py`.

---

## 7. API Key Authentication (Security)

Restrict all endpoints via global `Depends()` on the `FastAPI` app — no per-route changes needed, shows in OpenAPI docs.

**File:** `app/utils/dependencies.py`, `app/main.py`

```python
# dependencies.py
import os
from fastapi import Header, HTTPException

def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != os.environ["API_KEY"]:
        raise HTTPException(status_code=403, detail="Invalid API key")
```
```python
# main.py
app = FastAPI(dependencies=[Depends(verify_api_key)])
```

Store key in env var, not hardcoded.

---

## 8. Rate Limiting (Security)

Use **middleware** (`slowapi`) — needs request counting state, must intercept before route logic.

**Install:** `pip install slowapi`

```python
# main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Apply per-route or globally. Returns 429 on breach. Use Redis backend for multi-worker deployments.
