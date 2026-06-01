# Notpad — Restructuring TODO

## 1. Proper HTTP Status Codes (High Priority)

All errors currently return `200 OK` with message strings. Use proper codes.

**Files:** `routes/notes.py`, `routes/auth.py`, `routes/group.py`, `routes/media.py`

**Hint:** Replace `return {"message": "..."}` with `raise HTTPException(status_code=..., detail="...")`.
- 401 → not logged in, invalid password
- 404 → user/note not found
- 409 → user already exists
- 400 → no fields to update, invalid data

---

## 2. Auth Dependency via `Depends()` (High Priority)

Auth check duplicated in every route. Make it a proper FastAPI dependency that raises 401.

**File:** `dependencies.py`

**Hint:**
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

## 3. Move Credentials to Request Body (Security)

`register` and `login` take password as query param — visible in URL, browser history, server logs.

**File:** `routes/auth.py`

**Hint:** `UserCreate` schema already exists. Use as function param:
```python
def register(credentials: UserCreate):
```
FastAPI auto-reads Pydantic model from JSON body, not URL.

---

## 4. Move Note Data to Request Body

`create_note` and `update_note` use `Query()` params for title/body. Should be request body.

**File:** `routes/notes.py`, `schemas/note.py`

**Hint:** Create `NoteCreate` and `NoteUpdate` schemas:
```python
class NoteCreate(BaseModel):
    note_title: str = Field(min_length=10, max_length=100)
    note_body: str = Field(max_length=1000)
    bg_color: str = "#FFFFFF"
    is_pinned: bool = False

class NoteUpdate(BaseModel):
    note_title: str | None = None
    note_body: str | None = None
    bg_color: str | None = None
    is_pinned: bool | None = None
```
Then: `def create_note(data: NoteCreate, user_id: str = Depends(require_user_id)):`

---

## 5. Deduplicate `_find_note_by_id`

Same helper exists in 3 files with slightly different signatures.

**Files:** `routes/notes.py:27`, `routes/group.py:9`, `routes/media.py:9`

**Hint:** Move to `data_loader.py` as single function:
```python
def find_note_by_id(notes: list[Note], note_id: str) -> Note | None:
    return next((n for n in notes if n.note_id == note_id), None)
```
Import from `data_loader` in all three route files.

---

## 6. Stub Endpoints — Decide Fate

`group.py` and `media.py` endpoints return hardcoded messages, no real logic.

**Options:**
- Remove if not planned
- Keep but mark with `# TODO: implement` comments
- Implement properly with data persistence
