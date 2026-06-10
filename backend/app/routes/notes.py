import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import ValidationError

from app.utils.data_loader import load_notes, load_users, save_notes, load_voices, load_pictures, save_voices, save_pictures
from app.utils.dependencies import get_logged_in_user_id
from app.schemas.media import Picture, Voice
from app.schemas.note import Note, NoteCreate, NoteUpdate, MediaReference
from app.schemas.user import User

router = APIRouter(prefix="/notes", tags=["notes"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
IMAGE_UPLOAD_DIR = UPLOADS_DIR / "images"
VOICE_UPLOAD_DIR = UPLOADS_DIR / "voices"


def _make_upload_url(request: Request, subpath: str) -> str:
    return str(request.base_url).rstrip("/") + f"/uploads/{subpath}"


def _save_upload_file(file: UploadFile, target_dir: Path) -> str:
    target_dir.mkdir(parents=True, exist_ok=True)
    extension = Path(file.filename).suffix
    if not extension:
        raise HTTPException(status_code=400, detail="Uploaded file must have a valid file extension")
    filename = f"{uuid.uuid4()}{extension}"
    destination = target_dir / filename
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return filename


def _make_media_placeholder(media_type: str, index: int) -> str:
    """Generate placeholder in format [IMG:1] or [AUD:1]"""
    type_prefix = "IMG" if media_type == "image" else "AUD"
    return f"[{type_prefix}:{index}]"


def _get_next_image_index(note: Note) -> int:
    """Get the next available index for images in a note"""
    if not note.images:
        return 1
    return max(img.index for img in note.images) + 1


def _get_next_voice_index(note: Note) -> int:
    """Get the next available index for voices in a note"""
    if not note.voices:
        return 1
    return max(voice.index for voice in note.voices) + 1


def _find_user_by_id(users: list[User], user_id: str) -> Optional[User]:
    for user in users:
        if user.user_id == user_id:
            return user
    return None


def _get_user_notes_sorted(notes: list[Note], user_id: str) -> list[Note]:
    user_notes = [note for note in notes if note.user_id == user_id]
    #user_notes.sort(key=lambda note: not note.is_pinned)
    print(f" This is {user_id}")
    return user_notes


def _find_note_by_id(notes: list[Note], user_id: str, note_id: str) -> Optional[Note]:
    for note in notes:
        if note.note_id == note_id and note.user_id == user_id:
            return note
    return None


def _find_voice_by_id(voices: list[Voice], user_id: str, voice_id: str) -> Optional[Voice]:
    for voice in voices:
        if voice.voice_id == voice_id and voice.user_id == user_id:
            return voice
    return None


def _find_picture_by_id(pictures: list[Picture], user_id: str, picture_id: str) -> Optional[Picture]:
    for picture in pictures:
        if picture.picture_id == picture_id and picture.user_id == user_id:
            return picture
    return None


def _raise_validation_error(exc: Exception) -> None:
    if isinstance(exc, ValidationError):
        errors = []
        for error in exc.errors():
            field = ".".join(str(x) for x in error["loc"])
            msg = error["msg"]
            errors.append(f"{field}: {msg}")
        raise HTTPException(status_code=422, detail={"validation_errors": errors})
    raise HTTPException(status_code=422, detail={"validation_errors": [str(exc)]})


@router.post("/")
def create_note(request: Request, note: NoteCreate):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    users = load_users()
    if not _find_user_by_id(users, user_id):
        raise HTTPException(status_code=404, detail="User not found")

    notes = load_notes()
    try:
        note = Note(
            note_id=str(uuid.uuid4()),
            user_id=user_id,
            **note.model_dump(),
        )
    except (ValidationError, ValueError) as exc:
        _raise_validation_error(exc)

    notes.append(note)
    save_notes(notes)
    return {"message": "Note created successfully", "note": note}


@router.get("/")
def get_notes(request: Request, skip: int = 0, limit: int = 12, query: Optional[str] = None):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    # Validate pagination parameters
    if skip < 0:
        skip = 0
    if limit < 1 or limit > 100:
        limit = 12

    notes = load_notes()
    user_notes = _get_user_notes_sorted(notes, user_id)

    if query:
        normalized_query = query.strip().lower()
        if normalized_query:
            user_notes = [
                note for note in user_notes
                if normalized_query in (note.note_title or "").lower()
            ]

    # Calculate pagination
    total = len(user_notes)
    paginated_notes = user_notes[skip: skip + limit]

    return {
        "message": "Notes retrieved successfully",
        "notes": paginated_notes,
        "pagination": {
            "skip": skip,
            "limit": limit,
            "total": total,
            "page": skip // limit + 1,
            "total_pages": (total + limit - 1) // limit,
            "has_next": (skip + limit) < total,
            "has_prev": skip > 0,
        }
    }


@router.patch("/{note_id}")
def update_note(request: Request, note_id: str, note: NoteUpdate):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    updates = note.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    notes = load_notes()
    existing = _find_note_by_id(notes, user_id, note_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Note not found")

    try:
        for index, stored in enumerate(notes):
            if stored.note_id != note_id:
                continue
            notes[index] = stored.model_copy(update=updates)
            break
    except ValidationError as exc:
        _raise_validation_error(exc)

    save_notes(notes)
    updated = _find_note_by_id(notes, user_id, note_id)
    return {"message": "Note updated successfully", "note": updated}


@router.delete("/{note_id}")
def delete_note(request: Request, note_id: str):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    notes = load_notes()
    note = _find_note_by_id(notes, user_id, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    notes = [stored for stored in notes if stored.note_id != note_id]
    save_notes(notes)
    return {"message": "Note deleted successfully", "note": note}


@router.post("/{note_id}/images")
def upload_note_image(request: Request, note_id: str, file: UploadFile = File(...)):
    """Upload an image and return a placeholder token for the note body."""
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    notes = load_notes()
    note = _find_note_by_id(notes, user_id, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    filename = _save_upload_file(file, IMAGE_UPLOAD_DIR)
    image_url = _make_upload_url(request, f"images/{filename}")
    picture = Picture(
        picture_id=str(uuid.uuid4()),
        note_id=note_id,
        user_id=user_id,
        picture_url=image_url,
    )

    pictures = load_pictures()
    pictures.append(picture)
    save_pictures(pictures)

    # Get next image index for this note
    next_index = _get_next_image_index(note)
    placeholder = _make_media_placeholder("image", next_index)
    
    # Update note with new image reference and placeholder
    for idx, stored in enumerate(notes):
        if stored.note_id != note_id:
            continue
        new_body = f"{stored.note_body} {placeholder}" if stored.note_body else placeholder
        new_images = stored.images + [MediaReference(index=next_index, id=picture.picture_id)]
        notes[idx] = stored.model_copy(update={
            "note_body": new_body,
            "images": new_images
        })
        updated_note = notes[idx]
        break
    save_notes(notes)

    return {
        "message": "Image uploaded successfully",
        "image": picture,
        "placeholder": placeholder,
        "note": updated_note,
    }


@router.post("/{note_id}/voices")
def upload_note_voice(request: Request, note_id: str, file: UploadFile = File(...)):
    """Upload a voice file and return a placeholder token for the note body."""
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    notes = load_notes()
    note = _find_note_by_id(notes, user_id, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    filename = _save_upload_file(file, VOICE_UPLOAD_DIR)
    voice_url = _make_upload_url(request, f"voices/{filename}")
    voice = Voice(
        voice_id=str(uuid.uuid4()),
        note_id=note_id,
        user_id=user_id,
        voice_url=voice_url,
    )

    voices = load_voices()
    voices.append(voice)
    save_voices(voices)

    # Get next voice index for this note
    next_index = _get_next_voice_index(note)
    placeholder = _make_media_placeholder("audio", next_index)
    
    # Update note with new voice reference and placeholder
    for idx, stored in enumerate(notes):
        if stored.note_id != note_id:
            continue
        new_body = f"{stored.note_body} {placeholder}" if stored.note_body else placeholder
        new_voices = stored.voices + [MediaReference(index=next_index, id=voice.voice_id)]
        notes[idx] = stored.model_copy(update={
            "note_body": new_body,
            "voices": new_voices
        })
        updated_note = notes[idx]
        break
    save_notes(notes)

    return {
        "message": "Voice uploaded successfully",
        "voice": voice,
        "placeholder": placeholder,
        "note": updated_note,
    }


@router.get("/{note_id}/voices")
def get_note_voices(request: Request, note_id: str):
    """Get all voices for a specific note."""
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    voices = load_voices()
    note_voices = [voice for voice in voices if voice.note_id == note_id and voice.user_id == user_id]
    return {"message": "Voices retrieved successfully", "voices": note_voices}


@router.get("/{note_id}/voices/{voice_id}")
def get_note_voice(request: Request, note_id: str, voice_id: str):
    """Get a specific voice from a note."""
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    voices = load_voices()
    voice = _find_voice_by_id(voices, user_id, voice_id)
    if not voice or voice.note_id != note_id:
        raise HTTPException(status_code=404, detail="Voice not found")

    return {"message": "Voice retrieved successfully", "voice": voice}


@router.get("/{note_id}/images")
def get_note_images(request: Request, note_id: str):
    """Get all images for a specific note."""
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    pictures = load_pictures()
    note_pictures = [picture for picture in pictures if picture.note_id == note_id and picture.user_id == user_id]
    return {"message": "Images retrieved successfully", "images": note_pictures}


@router.get("/{note_id}/images/{image_id}")
def get_note_image(request: Request, note_id: str, image_id: str):
    """Get a specific image from a note."""
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    pictures = load_pictures()
    picture = _find_picture_by_id(pictures, user_id, image_id)
    if not picture or picture.note_id != note_id:
        raise HTTPException(status_code=404, detail="Image not found")

    return {"message": "Image retrieved successfully", "image": picture}
