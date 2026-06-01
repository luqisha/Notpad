import uuid
from pathlib import Path

from fastapi import APIRouter, Request

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


@router.get("/notes")
def get_notes(user_id: str):
    return {"message": "Notes retrieved successfully"}


@router.post("/notes")
def create_note(request: Request, title: str, body: str):
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
        "bg_color": "#FFFFFF",
        "is_pinned": False,
    }
    notes.append(note)
    write_file(_NOTES_FILE, notes)
    return {"message": "Note created successfully", "note": note}


@router.get("/notes/{note_id}")
def get_note(note_id: str):
    return {"message": "Note retrieved successfully"}


@router.patch("/notes/{note_id}")
def update_note(note_id: str, title: str, body: str):
    return {"message": "Note updated successfully"}


@router.delete("/notes/{note_id}")
def delete_note(note_id: str):
    return {"message": "Note deleted successfully"}
