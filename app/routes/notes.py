from fastapi import APIRouter

router = APIRouter(tags=["notes"])


@router.get("/notes")
def get_notes(user_id: str):
    return {"message": "Notes retrieved successfully"}

@router.post("/notes")
def create_note(user_id: str, title: str, body: str):
    return {"message": "Note created successfully"}

@router.get("/notes/{note_id}")
def get_note(note_id: str):
    return {"message": "Note retrieved successfully"}

@router.patch("/notes/{note_id}")
def update_note(note_id: str, title: str, body: str):
    return {"message": "Note updated successfully"}

@router.delete("/notes/{note_id}")
def delete_note(note_id: str):
    return {"message": "Note deleted successfully"}