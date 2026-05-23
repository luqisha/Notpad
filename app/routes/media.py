from fastapi import APIRouter

router = APIRouter(tags=["media"])


@router.post("/notes/{note_id}/voice")
def create_voice_note(note_id: str, voice_url: str):
    return {"message": "Voice note created successfully"}

@router.delete("/notes/{note_id}/voice/{voice_id}")
def delete_voice_note(note_id: str, voice_id: str):
    return {"message": "Voice note deleted successfully"}

@router.post("/notes/{note_id}/image")
def create_image_note(note_id: str, image_url: str):
    return {"message": "Image note created successfully"}

@router.delete("/notes/{note_id}/image/{image_id}")
def delete_image_note(note_id: str, image_id: str):
    return {"message": "Image note deleted successfully"}