from fastapi import APIRouter

from app.utils.data_loader import load_notes
from app.schemas.note import Note

router = APIRouter(tags=["media"])


def _find_note_by_id(note_id: str) -> Note | None:
    for note in load_notes():
        if note.note_id == note_id:
            return note
    return None


@router.post("/notes/{note_id}/voice")
def create_voice_note(note_id: str, voice_url: str):
    if not _find_note_by_id(note_id):
        return {"message": "Note not found"}
    return {"message": "Voice note created successfully"}


@router.delete("/notes/{note_id}/voice/{voice_id}")
def delete_voice_note(note_id: str, voice_id: str):
    if not _find_note_by_id(note_id):
        return {"message": "Note not found"}
    return {"message": "Voice note deleted successfully"}


@router.post("/notes/{note_id}/image")
def create_image_note(note_id: str, image_url: str):
    if not _find_note_by_id(note_id):
        return {"message": "Note not found"}
    return {"message": "Image note created successfully"}


@router.delete("/notes/{note_id}/image/{image_id}")
def delete_image_note(note_id: str, image_id: str):
    if not _find_note_by_id(note_id):
        return {"message": "Note not found"}
    return {"message": "Image note deleted successfully"}
