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

import app.utils.data_loader as dl
from app.utils.database import DBUser, DBNote, DBPicture, DBVoice
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

    if not dl.get_record(DBUser, user_id=user_id):
        raise HTTPException(status_code=404, detail="User not found")

    is_pinned_bool = is_pinned.lower() in ("true", "1", "yes")

    note_id = str(uuid.uuid4())
    image_body = note_body
    image_references: list[MediaReference] = []

    temp_note = Note(
        note_id=note_id,
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
            
            next_index = _get_next_image_index(temp_note)
            picture_id = str(uuid.uuid4())
            
            dl.create_record(
                DBPicture,
                picture_id=picture_id,
                note_id=note_id,
                user_id=user_id,
                picture_url=image_url,
                file_hash=file_hash,
                index=next_index
            )

            placeholder = _make_media_placeholder("image", next_index)
            image_body = f"{image_body} {placeholder}".strip()
            image_references.append(MediaReference(index=next_index, id=picture_id))
            temp_note = temp_note.model_copy(update={"note_body": image_body, "images": image_references})

    note = dl.create_record(
        DBNote,
        note_id=note_id,
        user_id=user_id,
        note_title=note_title,
        note_body=image_body,
        bg_color=bg_color,
        is_pinned=is_pinned_bool
    )
    return {"message": "Note created successfully", "note": note}


@router.post("")
@limiter.limit("60/minute")
def create_note(request: Request, note: NoteCreate, user_id: str = Depends(require_user_id)):

    if not dl.get_record(DBUser, user_id=user_id):
        raise HTTPException(status_code=404, detail="User not found")

    note_obj = dl.create_record(
        DBNote,
        note_id=str(uuid.uuid4()),
        user_id=user_id,
        note_title=note.note_title,
        note_body=note.note_body,
        bg_color=note.bg_color,
        is_pinned=note.is_pinned
    )
    return {"message": "Note created successfully", "note": note_obj}


@router.get("")
@limiter.limit("120/minute")
def get_notes(request: Request, skip: int = 0, limit: int = 12, query: Optional[str] = None, user_id: str = Depends(require_user_id)):

    if skip < 0:
        skip = 0
    if limit < 1 or limit > 100:
        limit = 12

    paginated_notes, total = dl.get_records(DBNote, order_by=DBNote.note_id, skip=skip, limit=limit, query_attr="note_title", query=query, user_id=user_id)

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

    existing = dl.get_record(DBNote, note_id=note_id, user_id=user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Note not found")

    new_body = updates.get("note_body", existing.note_body)
    referenced_image_indices = _extract_image_indices_from_body(new_body)
    referenced_voice_indices = _extract_voice_indices_from_body(new_body)

    current_image_refs = {ref.index: ref for ref in existing.images}
    orphaned_image_refs = [ref for idx, ref in current_image_refs.items() if idx not in referenced_image_indices]

    if orphaned_image_refs:
        for ref in orphaned_image_refs:
            picture = dl.get_record(DBPicture, picture_id=ref.id, user_id=user_id)
            if picture:
                picture_path = urlparse(picture.picture_url).path
                image_file = IMAGE_UPLOAD_DIR / Path(picture_path).name
                image_file.unlink(missing_ok=True)
                dl.delete_record(DBPicture, picture_id=ref.id, user_id=user_id)

    current_voice_refs = {ref.index: ref for ref in existing.voices}
    orphaned_voice_refs = [ref for idx, ref in current_voice_refs.items() if idx not in referenced_voice_indices]

    if orphaned_voice_refs:
        for ref in orphaned_voice_refs:
            voice = dl.get_record(DBVoice, voice_id=ref.id, user_id=user_id)
            if voice:
                voice_path = urlparse(voice.voice_url).path
                voice_file = VOICE_UPLOAD_DIR / Path(voice_path).name
                voice_file.unlink(missing_ok=True)
                dl.delete_record(DBVoice, voice_id=ref.id, user_id=user_id)

    updated = dl.update_record(
        DBNote,
        filter_kwargs={"note_id": note_id, "user_id": user_id},
        update_kwargs={
            "note_title": updates.get("note_title"),
            "note_body": updates.get("note_body"),
            "bg_color": updates.get("bg_color"),
            "is_pinned": updates.get("is_pinned")
        },
        raise_if_missing=True,
        missing_detail="Note not found"
    )
    return {"message": "Note updated successfully", "note": updated}


@router.delete("/{note_id}")
@limiter.limit("60/minute")
def delete_note(request: Request, note_id: str, user_id: str = Depends(require_user_id)):

    note = dl.get_record(DBNote, note_id=note_id, user_id=user_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    dl.delete_record(DBNote, note_id=note_id, user_id=user_id)
    return {"message": "Note deleted successfully", "note": note}


@router.post("/{note_id}/images")
@limiter.limit("30/minute")
def upload_note_image(request: Request, note_id: str, file: UploadFile = File(...), user_id: str = Depends(require_user_id)):
    """Upload an image and return a placeholder token for the note body."""

    note = dl.get_record(DBNote, note_id=note_id, user_id=user_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    filename, file_hash = _save_upload_file(file, IMAGE_UPLOAD_DIR, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE)
    image_url = _make_upload_url(request, f"images/{filename}")

    existing = dl.get_record(DBPicture, note_id=note_id, file_hash=file_hash)

    if existing:
        picture = existing
        (IMAGE_UPLOAD_DIR / filename).unlink(missing_ok=True)
        next_index = None
        for ref in note.images:
            if ref.id == picture.picture_id:
                next_index = ref.index
                break
        if next_index is None:
            next_index = _get_next_image_index(note)
    else:
        next_index = _get_next_image_index(note)
        picture = dl.create_record(
            DBPicture,
            picture_id=str(uuid.uuid4()),
            note_id=note_id,
            user_id=user_id,
            picture_url=image_url,
            file_hash=file_hash,
            index=next_index
        )
        placeholder = _make_media_placeholder("image", next_index)
        new_body = f"{note.note_body} {placeholder}" if note.note_body else placeholder
        dl.update_record(DBNote, filter_kwargs={"note_id": note_id, "user_id": user_id}, update_kwargs={"note_body": new_body})

    placeholder = _make_media_placeholder("image", next_index)
    updated_note = dl.get_record(DBNote, note_id=note_id, user_id=user_id)
    return {
        "message": "Image uploaded successfully" if not existing else "Image already exists in this note",
        "image": picture,
        "placeholder": placeholder,
        "note": updated_note,
    }


@router.post("/{note_id}/voices")
@limiter.limit("30/minute")
def upload_note_voice(request: Request, note_id: str, file: UploadFile = File(...), user_id: str = Depends(require_user_id)):
    """Upload a voice file and return a placeholder token for the note body."""

    note = dl.get_record(DBNote, note_id=note_id, user_id=user_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    filename, _ = _save_upload_file(file, VOICE_UPLOAD_DIR, ALLOWED_VOICE_MIME_TYPES, MAX_VOICE_SIZE)
    voice_url = _make_upload_url(request, f"voices/{filename}")

    next_index = _get_next_voice_index(note)
    voice = dl.create_record(
        DBVoice,
        voice_id=str(uuid.uuid4()),
        note_id=note_id,
        user_id=user_id,
        voice_url=voice_url,
        index=next_index
    )

    placeholder = _make_media_placeholder("audio", next_index)
    new_body = f"{note.note_body} {placeholder}" if note.note_body else placeholder
    dl.update_record(DBNote, filter_kwargs={"note_id": note_id, "user_id": user_id}, update_kwargs={"note_body": new_body})

    updated_note = dl.get_record(DBNote, note_id=note_id, user_id=user_id)
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
    if not dl.get_record(DBNote, note_id=note_id, user_id=user_id):
        raise HTTPException(status_code=404, detail="Note not found")
    voices, _ = dl.get_records(DBVoice, order_by=DBVoice.index, note_id=note_id, user_id=user_id)
    return {"message": "Voices retrieved successfully", "voices": voices}


@router.get("/{note_id}/voices/{voice_id}")
@limiter.limit("120/minute")
def get_note_voice(request: Request, note_id: str, voice_id: str, user_id: str = Depends(require_user_id)):
    """Get a specific voice from a note."""
    if not dl.get_record(DBNote, note_id=note_id, user_id=user_id):
        raise HTTPException(status_code=404, detail="Note not found")
    voice = dl.get_record(DBVoice, voice_id=voice_id, user_id=user_id)
    if not voice or voice.note_id != note_id:
        raise HTTPException(status_code=404, detail="Voice not found")
    return {"message": "Voice retrieved successfully", "voice": voice}


@router.get("/{note_id}/images")
@limiter.limit("120/minute")
def get_note_images(request: Request, note_id: str, user_id: str = Depends(require_user_id)):
    """Get all images for a specific note."""
    if not dl.get_record(DBNote, note_id=note_id, user_id=user_id):
        raise HTTPException(status_code=404, detail="Note not found")
    pics, _ = dl.get_records(DBPicture, order_by=DBPicture.index, note_id=note_id, user_id=user_id)
    return {"message": "Images retrieved successfully", "images": pics}


@router.get("/{note_id}/images/{image_id}")
@limiter.limit("120/minute")
def get_note_image(request: Request, note_id: str, image_id: str, user_id: str = Depends(require_user_id)):
    """Get a specific image from a note."""
    if not dl.get_record(DBNote, note_id=note_id, user_id=user_id):
        raise HTTPException(status_code=404, detail="Note not found")
    picture = dl.get_record(DBPicture, picture_id=image_id, user_id=user_id)
    if not picture or picture.note_id != note_id:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"message": "Image retrieved successfully", "image": picture}


@router.delete("/{note_id}/images/{image_id}")
@limiter.limit("60/minute")
def delete_note_image(request: Request, note_id: str, image_id: str, user_id: str = Depends(require_user_id)):
    """Delete an image from a note."""
    note = dl.get_record(DBNote, note_id=note_id, user_id=user_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    picture = dl.get_record(DBPicture, picture_id=image_id, user_id=user_id)
    if not picture or picture.note_id != note_id:
        raise HTTPException(status_code=404, detail="Image not found")

    picture_path = urlparse(picture.picture_url).path
    image_file = IMAGE_UPLOAD_DIR / Path(picture_path).name
    image_file.unlink(missing_ok=True)

    dl.delete_record(DBPicture, picture_id=image_id, user_id=user_id)

    removed_index = None
    for ref in note.images:
        if ref.id == image_id:
            removed_index = ref.index
            break

    new_body = note.note_body
    if removed_index is not None:
        new_body = re.sub(rf'\[IMG:{removed_index}[^\]]*\]\s*', '', new_body).strip()

    dl.update_record(DBNote, filter_kwargs={"note_id": note_id, "user_id": user_id}, update_kwargs={"note_body": new_body})
    updated_note = dl.get_record(DBNote, note_id=note_id, user_id=user_id)
    return {"message": "Image deleted successfully", "note": updated_note}


@router.delete("/{note_id}/voices/{voice_id}")
@limiter.limit("60/minute")
def delete_note_voice(request: Request, note_id: str, voice_id: str, user_id: str = Depends(require_user_id)):
    """Delete a voice from a note."""
    note = dl.get_record(DBNote, note_id=note_id, user_id=user_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    voice = dl.get_record(DBVoice, voice_id=voice_id, user_id=user_id)
    if not voice or voice.note_id != note_id:
        raise HTTPException(status_code=404, detail="Voice not found")

    voice_path = urlparse(voice.voice_url).path
    voice_file = VOICE_UPLOAD_DIR / Path(voice_path).name
    voice_file.unlink(missing_ok=True)

    dl.delete_record(DBVoice, voice_id=voice_id, user_id=user_id)

    removed_index = None
    for ref in note.voices:
        if ref.id == voice_id:
            removed_index = ref.index
            break

    new_body = note.note_body
    if removed_index is not None:
        new_body = re.sub(rf'\[AUD:{removed_index}[^\]]*\]\s*', '', new_body).strip()

    dl.update_record(DBNote, filter_kwargs={"note_id": note_id, "user_id": user_id}, update_kwargs={"note_body": new_body})
    updated_note = dl.get_record(DBNote, note_id=note_id, user_id=user_id)
    return {"message": "Voice deleted successfully", "note": updated_note}
