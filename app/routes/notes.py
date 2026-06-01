import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query, Request

from app.dependencies import get_logged_in_user_id
from app.utils.storage import read_file, write_file

_NOTES_FILE = Path(__file__).resolve().parent.parent / "data" / "note.json"
_USERS_FILE = Path(__file__).resolve().parent.parent / "data" / "user.json"

router = APIRouter(tags=["notes"])


def _find_user_by_id(users: list, user_id: str):
    for user in users:
        if user["user_id"] == user_id:
            return user
    return None


def _get_user_notes_sorted(notes: list, user_id: str) -> list:
    user_notes = [note for note in notes if note["user_id"] == user_id]
    user_notes.sort(key=lambda note: not note.get("is_pinned", False))
    return user_notes


def _find_note_by_id(notes: list, user_id: str, note_id: str) -> Optional[dict]:
    for note in notes:
        if note["note_id"] == note_id and note["user_id"] == user_id:
            return note
    return None


@router.post("/notes")
def create_note(
    request: Request,
    title: str,
    body: str,
    is_pinned: bool = Query(
        default=False,
        description="Pin the note. Defaults to false; set true to pin.",
    ),
    bg_color: str = Query(
        default="#FFFFFF",
        description="Background hex color (e.g. #E3F2FD). Defaults to #FFFFFF.",
    ),
):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        return {"message": "no user is logged in"}

    users = read_file(_USERS_FILE)
    if not _find_user_by_id(users, user_id):
        return {"message": "User not found"}

    notes = read_file(_NOTES_FILE)
    note = {
        "note_id": str(uuid.uuid4()),
        "user_id": user_id,
        "note_title": title,
        "note_body": body,
        "bg_color": bg_color,
        "is_pinned": is_pinned,
    }
    notes.append(note)
    write_file(_NOTES_FILE, notes)
    return {"message": "Note created successfully", "note": note}


@router.get("/notes")
def get_notes(request: Request):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        return {"message": "no user is logged in"}

    notes = read_file(_NOTES_FILE)
    user_notes = _get_user_notes_sorted(notes, user_id)
    return {"message": "Notes retrieved successfully", "notes": user_notes}


@router.patch("/notes/{note_id}")
def update_note(
    request: Request,
    note_id: str,
    title: Optional[str] = Query(default=None, description="New note title."),
    body: Optional[str] = Query(default=None, description="New note body."),
    bg_color: Optional[str] = Query(default=None, description="New background hex color."),
    is_pinned: Optional[bool] = Query(default=None, description="Pin or unpin the note."),
):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        return {"message": "no user is logged in"}

    if all(v is None for v in (title, body, bg_color, is_pinned)):
        return {"message": "No fields to update"}

    notes = read_file(_NOTES_FILE)
    if not _find_note_by_id(notes, user_id, note_id):
        return {"message": "Note not found"}

    for stored in notes:
        if stored["note_id"] != note_id:
            continue
        if title is not None:
            stored["note_title"] = title
        if body is not None:
            stored["note_body"] = body
        if bg_color is not None:
            stored["bg_color"] = bg_color
        if is_pinned is not None:
            stored["is_pinned"] = is_pinned
        break

    write_file(_NOTES_FILE, notes)
    updated = _find_note_by_id(notes, user_id, note_id)
    return {"message": "Note updated successfully", "note": updated}


@router.delete("/notes/{note_id}")
def delete_note(request: Request, note_id: str):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        return {"message": "no user is logged in"}

    notes = read_file(_NOTES_FILE)
    note = _find_note_by_id(notes, user_id, note_id)
    if not note:
        return {"message": "Note not found"}

    notes = [stored for stored in notes if stored["note_id"] != note_id]
    write_file(_NOTES_FILE, notes)
    return {"message": "Note deleted successfully", "note": note}
