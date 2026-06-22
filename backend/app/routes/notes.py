import filetype
import hashlib
import re
import shutil
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.utils.data_loader import (
    load_notes,
    load_users,
    save_notes,
    load_voices,
    load_pictures,
    save_voices,
    save_pictures,
    _find_user_by_id,
    _find_note_by_id,
    _find_voice_by_id,
    _find_picture_by_id,
)
from app.utils.dependencies import require_user_id, verify_api_key
from app.schemas.media import Picture, Voice
from app.schemas.note import Note, NoteCreate, NoteUpdate, MediaReference
from app.schemas.user import User

router = APIRouter(prefix="/notes", tags=["notes"], redirect_slashes=False, dependencies=[Depends(verify_api_key)])

limiter = Limiter(key_func=get_remote_address)
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
IMAGE_UPLOAD_DIR = UPLOADS_DIR / "images"
VOICE_UPLOAD_DIR = UPLOADS_DIR / "voices"

MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_VOICE_SIZE = 50 * 1024 * 1024

ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
}

ALLOWED_VOICE_MIME_TYPES = {
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/flac",
    "audio/aac",
    "audio/amr",
    "audio/webm",
    "video/webm",
}


def _validate_upload_file(file: UploadFile, allowed_mimes: set[str], max_size: int) -> None:
    content_type = file.content_type
    if not content_type or content_type not in allowed_mimes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(sorted(allowed_mimes))}",
        )

    file.file.seek(0)
    header = file.file.read(8192)
    file.file.seek(0)

    kind = filetype.guess(header)
    if kind is None or kind.mime not in allowed_mimes:
        detected = kind.mime if kind else "unknown"
        raise HTTPException(
            status_code=400,
            detail=f"File content does not match allowed types. Detected: {detected}",
        )

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum allowed size of {max_size // (1024 * 1024)}MB",
        )


def _make_upload_url(request: Request, subpath: str) -> str:
    return str(request.base_url).rstrip("/") + f"/uploads/{subpath}"


def _save_upload_file(
    file: UploadFile, target_dir: Path, allowed_mimes: set[str], max_size: int
) -> tuple[str, str]:
    _validate_upload_file(file, allowed_mimes, max_size)

    target_dir.mkdir(parents=True, exist_ok=True)
    extension = Path(file.filename).suffix
    if not extension:
        raise HTTPException(status_code=400, detail="Uploaded file must have a valid file extension")
    filename = f"{uuid.uuid4()}{extension}"
    destination = target_dir / filename
    sha256 = hashlib.sha256()
    with destination.open("wb") as buffer:
        while chunk := file.file.read(8192):
            sha256.update(chunk)
            buffer.write(chunk)
    file_hash = sha256.hexdigest()
    return filename, file_hash


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


@router.post("/with-images")
@limiter.limit("30/minute")
def create_note_with_images(
    request: Request,
    note_title: str = Form(...),
    note_body: str = Form(...),
    bg_color: str = Form("#FFFFFF"),
    is_pinned: str = Form("false"),
    images: Optional[list] = File(None),
    user_id: str = Depends(require_user_id),
):

    users = load_users()
    if not _find_user_by_id(users, user_id):
        raise HTTPException(status_code=404, detail="User not found")

    notes = load_notes()
    image_references: list[MediaReference] = []
    image_body = note_body
    pictures = load_pictures()

    # Convert string to boolean
    is_pinned_bool = is_pinned.lower() in ("true", "1", "yes")

    note = Note(
        note_id=str(uuid.uuid4()),
        user_id=user_id,
        note_title=note_title,
        note_body=note_body,
        bg_color=bg_color,
        is_pinned=is_pinned_bool,
        images=[],
        voices=[],
    )

    if images:
        for file in images:
            filename, file_hash = _save_upload_file(file, IMAGE_UPLOAD_DIR, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE)
            image_url = _make_upload_url(request, f"images/{filename}")
            picture = Picture(
                picture_id=str(uuid.uuid4()),
                note_id=note.note_id,
                user_id=user_id,
                picture_url=image_url,
                file_hash=file_hash,
            )
            pictures.append(picture)

            next_index = _get_next_image_index(note)
            placeholder = _make_media_placeholder("image", next_index)
            image_body = f"{image_body} {placeholder}".strip()
            image_references.append(MediaReference(index=next_index, id=picture.picture_id))
            note = note.model_copy(update={"note_body": image_body, "images": image_references})

        save_pictures(pictures)

    notes.append(note)
    save_notes(notes)
    return {"message": "Note created successfully", "note": note}


@router.post("")
@limiter.limit("60/minute")
def create_note(request: Request, note: NoteCreate, user_id: str = Depends(require_user_id)):

    users = load_users()
    if not _find_user_by_id(users, user_id):
        raise HTTPException(status_code=404, detail="User not found")

    notes = load_notes()
    note = Note(
        note_id=str(uuid.uuid4()),
        user_id=user_id,
        **note.model_dump(),
    )

    notes.append(note)
    save_notes(notes)
    return {"message": "Note created successfully", "note": note}


@router.get("")
@limiter.limit("120/minute")
def get_notes(request: Request, skip: int = 0, limit: int = 12, query: Optional[str] = None, user_id: str = Depends(require_user_id)):

    # Validate pagination parameters
    if skip < 0:
        skip = 0
    if limit < 1 or limit > 100:
        limit = 12

    
    # Filter notes for current user only
    normalized_query = None
    if query:
        normalized_query = query.strip().lower()
    
    # Load fresh notes from file
    notes = load_notes()
    
    # Single pass: filter user notes and search, collect only what we need
    user_notes = []
    total = 0
    
    for note in notes:
        if note.user_id != user_id:
            continue
        
        # Apply search filter if provided
        if normalized_query and normalized_query not in (note.note_title or "").lower():
            continue
        
        total += 1
        
        # Collect only the notes needed for this page
        if total > skip and len(user_notes) < limit:
            user_notes.append(note)

    # Calculate pagination
    paginated_notes = user_notes

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


def _extract_image_indices_from_body(body: str) -> set[int]:
    """Extract all image indices from placeholders in the note body."""
    indices = set()
    for match in re.finditer(r'\[IMG:(\d+)(\|[^\]]+)?\]', body):
        indices.add(int(match.group(1)))
    return indices


def _extract_voice_indices_from_body(body: str) -> set[int]:
    """Extract all voice indices from placeholders in the note body."""
    indices = set()
    for match in re.finditer(r'\[AUD:(\d+)(\|[^\]]+)?\]', body):
        indices.add(int(match.group(1)))
    return indices


@router.patch("/{note_id}")
@limiter.limit("60/minute")
def update_note(request: Request, note_id: str, note: NoteUpdate, user_id: str = Depends(require_user_id)):

    updates = note.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    notes = load_notes()
    existing = _find_note_by_id(notes, user_id, note_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Note not found")

    new_body = updates.get("note_body", existing.note_body)
    referenced_image_indices = _extract_image_indices_from_body(new_body)
    referenced_voice_indices = _extract_voice_indices_from_body(new_body)

    current_image_refs = {ref.index: ref for ref in existing.images}
    orphaned_image_refs = [ref for idx, ref in current_image_refs.items() if idx not in referenced_image_indices]

    if orphaned_image_refs:
        pictures = load_pictures()
        for ref in orphaned_image_refs:
            picture = _find_picture_by_id(pictures, user_id, ref.id)
            if picture:
                picture_path = urlparse(picture.picture_url).path
                image_file = IMAGE_UPLOAD_DIR / Path(picture_path).name
                image_file.unlink(missing_ok=True)
                pictures = [p for p in pictures if p.picture_id != ref.id]
        save_pictures(pictures)

    updated_images = [ref for ref in existing.images if ref.index in referenced_image_indices]

    current_voice_refs = {ref.index: ref for ref in existing.voices}
    orphaned_voice_refs = [ref for idx, ref in current_voice_refs.items() if idx not in referenced_voice_indices]

    if orphaned_voice_refs:
        voices = load_voices()
        for ref in orphaned_voice_refs:
            voice = _find_voice_by_id(voices, user_id, ref.id)
            if voice:
                voice_path = urlparse(voice.voice_url).path
                voice_file = VOICE_UPLOAD_DIR / Path(voice_path).name
                voice_file.unlink(missing_ok=True)
                voices = [v for v in voices if v.voice_id != ref.id]
        save_voices(voices)

    updated_voices = [ref for ref in existing.voices if ref.index in referenced_voice_indices]

    final_updates = {**updates, "images": updated_images, "voices": updated_voices}

    for index, stored in enumerate(notes):
        if stored.note_id != note_id:
            continue
        notes[index] = stored.model_copy(update=final_updates)
        break

    save_notes(notes)
    updated = _find_note_by_id(notes, user_id, note_id)
    return {"message": "Note updated successfully", "note": updated}


@router.delete("/{note_id}")
@limiter.limit("60/minute")
def delete_note(request: Request, note_id: str, user_id: str = Depends(require_user_id)):

    notes = load_notes()
    note = _find_note_by_id(notes, user_id, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    notes = [stored for stored in notes if stored.note_id != note_id]
    save_notes(notes)
    return {"message": "Note deleted successfully", "note": note}


@router.post("/{note_id}/images")
@limiter.limit("30/minute")
def upload_note_image(request: Request, note_id: str, file: UploadFile = File(...), user_id: str = Depends(require_user_id)):
    """Upload an image and return a placeholder token for the note body."""

    notes = load_notes()
    note = _find_note_by_id(notes, user_id, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    filename, file_hash = _save_upload_file(file, IMAGE_UPLOAD_DIR, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE)
    image_url = _make_upload_url(request, f"images/{filename}")

    pictures = load_pictures()

    # Check for duplicate image in the same note by file hash
    existing = None
    for pic in pictures:
        if pic.note_id == note_id and pic.file_hash == file_hash:
            existing = pic
            # Remove the just-saved duplicate file
            (IMAGE_UPLOAD_DIR / filename).unlink(missing_ok=True)
            break

    if existing:
        picture = existing
        # Find the existing index from note references
        next_index = None
        for ref in note.images:
            if ref.id == picture.picture_id:
                next_index = ref.index
                break
        if next_index is None:
            next_index = _get_next_image_index(note)
    else:
        picture = Picture(
            picture_id=str(uuid.uuid4()),
            note_id=note_id,
            user_id=user_id,
            picture_url=image_url,
            file_hash=file_hash,
        )
        pictures.append(picture)
        save_pictures(pictures)

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

    placeholder = _make_media_placeholder("image", next_index)
    return {
        "message": "Image already exists in this note",
        "image": picture,
        "placeholder": placeholder,
        "note": note,
    }


@router.post("/{note_id}/voices")
@limiter.limit("30/minute")
def upload_note_voice(request: Request, note_id: str, file: UploadFile = File(...), user_id: str = Depends(require_user_id)):
    """Upload a voice file and return a placeholder token for the note body."""

    notes = load_notes()
    note = _find_note_by_id(notes, user_id, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    filename, _ = _save_upload_file(file, VOICE_UPLOAD_DIR, ALLOWED_VOICE_MIME_TYPES, MAX_VOICE_SIZE)
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
@limiter.limit("120/minute")
def get_note_voices(request: Request, note_id: str, user_id: str = Depends(require_user_id)):
    """Get all voices for a specific note."""

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    voices = load_voices()
    note_voices = [voice for voice in voices if voice.note_id == note_id and voice.user_id == user_id]
    return {"message": "Voices retrieved successfully", "voices": note_voices}


@router.get("/{note_id}/voices/{voice_id}")
@limiter.limit("120/minute")
def get_note_voice(request: Request, note_id: str, voice_id: str, user_id: str = Depends(require_user_id)):
    """Get a specific voice from a note."""

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    voices = load_voices()
    voice = _find_voice_by_id(voices, user_id, voice_id)
    if not voice or voice.note_id != note_id:
        raise HTTPException(status_code=404, detail="Voice not found")

    return {"message": "Voice retrieved successfully", "voice": voice}


@router.get("/{note_id}/images")
@limiter.limit("120/minute")
def get_note_images(request: Request, note_id: str, user_id: str = Depends(require_user_id)):
    """Get all images for a specific note."""

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    pictures = load_pictures()
    note_pictures = [picture for picture in pictures if picture.note_id == note_id and picture.user_id == user_id]
    return {"message": "Images retrieved successfully", "images": note_pictures}


@router.get("/{note_id}/images/{image_id}")
@limiter.limit("120/minute")
def get_note_image(request: Request, note_id: str, image_id: str, user_id: str = Depends(require_user_id)):
    """Get a specific image from a note."""

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    pictures = load_pictures()
    picture = _find_picture_by_id(pictures, user_id, image_id)
    if not picture or picture.note_id != note_id:
        raise HTTPException(status_code=404, detail="Image not found")

    return {"message": "Image retrieved successfully", "image": picture}


@router.delete("/{note_id}/images/{image_id}")
@limiter.limit("60/minute")
def delete_note_image(request: Request, note_id: str, image_id: str, user_id: str = Depends(require_user_id)):
    """Delete an image from a note."""

    notes = load_notes()
    note = _find_note_by_id(notes, user_id, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    pictures = load_pictures()
    picture = _find_picture_by_id(pictures, user_id, image_id)
    if not picture or picture.note_id != note_id:
        raise HTTPException(status_code=404, detail="Image not found")

    # Remove the file from disk
    picture_path = urlparse(picture.picture_url).path
    image_file = IMAGE_UPLOAD_DIR / Path(picture_path).name
    image_file.unlink(missing_ok=True)

    # Remove picture record
    pictures = [p for p in pictures if p.picture_id != image_id]
    save_pictures(pictures)

    # Find the image index from note references and remove it
    removed_index = None
    for ref in note.images:
        if ref.id == image_id:
            removed_index = ref.index
            break

    # Update note: remove image reference and placeholder from body
    new_images = [ref for ref in note.images if ref.id != image_id]
    new_body = note.note_body
    if removed_index is not None:
        new_body = re.sub(rf'\[IMG:{removed_index}[^\]]*\]\s*', '', new_body).strip()

    for idx, stored in enumerate(notes):
        if stored.note_id != note_id:
            continue
        notes[idx] = stored.model_copy(update={
            "note_body": new_body,
            "images": new_images,
        })
        updated_note = notes[idx]
        break
    save_notes(notes)

    return {"message": "Image deleted successfully", "note": updated_note}


@router.delete("/{note_id}/voices/{voice_id}")
@limiter.limit("60/minute")
def delete_note_voice(request: Request, note_id: str, voice_id: str, user_id: str = Depends(require_user_id)):
    """Delete a voice from a note."""

    notes = load_notes()
    note = _find_note_by_id(notes, user_id, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    voices = load_voices()
    voice = _find_voice_by_id(voices, user_id, voice_id)
    if not voice or voice.note_id != note_id:
        raise HTTPException(status_code=404, detail="Voice not found")

    # Remove the file from disk
    voice_path = urlparse(voice.voice_url).path
    voice_file = VOICE_UPLOAD_DIR / Path(voice_path).name
    voice_file.unlink(missing_ok=True)

    # Remove voice record
    voices = [v for v in voices if v.voice_id != voice_id]
    save_voices(voices)

    # Find the voice index from note references and remove it
    removed_index = None
    for ref in note.voices:
        if ref.id == voice_id:
            removed_index = ref.index
            break

    # Update note: remove voice reference and placeholder from body
    new_voices = [ref for ref in note.voices if ref.id != voice_id]
    new_body = note.note_body
    if removed_index is not None:
        new_body = re.sub(rf'\[AUD:{removed_index}[^\]]*\]\s*', '', new_body).strip()

    for idx, stored in enumerate(notes):
        if stored.note_id != note_id:
            continue
        notes[idx] = stored.model_copy(update={
            "note_body": new_body,
            "voices": new_voices,
        })
        updated_note = notes[idx]
        break
    save_notes(notes)

    return {"message": "Voice deleted successfully", "note": updated_note}
