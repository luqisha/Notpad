from fastapi import APIRouter

from app.data_loader import load_notes
from app.schemas.note import Note

router = APIRouter(tags=["group"])


def _find_note_by_id(note_id: str) -> Note | None:
    for note in load_notes():
        if note.note_id == note_id:
            return note
    return None


@router.get("/groups")
def get_groups(user_id: str):
    return {"message": "Groups retrieved successfully"}


@router.post("/groups")
def create_group(user_id: str, name: str, description: str):
    return {"message": "Group created successfully"}


@router.patch("/groups/{group_id}")
def update_group(group_id: str, name: str, description: str):
    return {"message": "Group updated successfully"}


@router.delete("/groups/{group_id}")
def delete_group(group_id: str):
    return {"message": "Group deleted successfully"}


@router.post("/groups/{group_id}/notes")
def create_group_note(group_id: str, note_id: str):
    if not _find_note_by_id(note_id):
        return {"message": "Note not found"}
    return {"message": "Group note created successfully"}


@router.delete("/groups/{group_id}/notes/{note_id}")
def delete_group_note(group_id: str, note_id: str):
    if not _find_note_by_id(note_id):
        return {"message": "Note not found"}
    return {"message": "Group note deleted successfully"}
