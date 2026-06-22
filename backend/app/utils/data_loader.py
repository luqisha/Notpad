from pathlib import Path
from typing import Optional

from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.note import Note
from app.schemas.user import User
from app.schemas.group import Group
from app.schemas.media import Voice, Picture
from app.utils.storage import read_file, write_file

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
_IMAGE_UPLOAD_DIR = _UPLOADS_DIR / "images"
_VOICE_UPLOAD_DIR = _UPLOADS_DIR / "voices"
_USERS_FILE = _DATA_DIR / "user.json"
_NOTES_FILE = _DATA_DIR / "note.json"
_GROUPS_FILE = _DATA_DIR / "group.json"
_GROUP_NOTES_LIST_FILE = _DATA_DIR / "group_notes_list.json"
_VOICES_FILE = _DATA_DIR / "note_voice.json"
_PICTURES_FILE = _DATA_DIR / "note_pictures.json"
_DATA_FILES = [
    "user.json",
    "note.json",
    "group.json",
    "group_notes_list.json",
    "note_voice.json",
    "note_pictures.json",
]


def init_data_files() -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _IMAGE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    _VOICE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    for filename in _DATA_FILES:
        path = _DATA_DIR / filename
        if not path.exists():
            write_file(path, [])


def load_users() -> list[User]:
    return [User.model_validate(user) for user in read_file(_USERS_FILE)]


def save_users(users: list[User]) -> None:
    write_file(_USERS_FILE, [user.model_dump() for user in users])


def load_notes() -> list[Note]:
    return [Note.model_validate(note) for note in read_file(_NOTES_FILE)]




def save_notes(notes: list[Note]) -> None:
    write_file(_NOTES_FILE, [note.model_dump() for note in notes])


def load_groups() -> list["Group"]:
    from app.schemas.group import Group  # local import to avoid circular

    return [Group.model_validate(group) for group in read_file(_GROUPS_FILE)]


def save_groups(groups: list["Group"]) -> None:
    write_file(_GROUPS_FILE, [group.model_dump() for group in groups])


def load_voices() -> list[Voice]:
    return [Voice.model_validate(voice) for voice in read_file(_VOICES_FILE)]


def save_voices(voices: list[Voice]) -> None:
    write_file(_VOICES_FILE, [voice.model_dump() for voice in voices])


def load_pictures() -> list[Picture]:
    return [Picture.model_validate(picture) for picture in read_file(_PICTURES_FILE)]


def save_pictures(pictures: list[Picture]) -> None:
    write_file(_PICTURES_FILE, [picture.model_dump() for picture in pictures])


def load_group_notes_list() -> list["GroupNotesItem"]:
    from app.schemas.group import GroupNotesItem

    return [GroupNotesItem.model_validate(item) for item in read_file(_GROUP_NOTES_LIST_FILE)]


def save_group_notes_list(items: list["GroupNotesItem"]) -> None:
    write_file(_GROUP_NOTES_LIST_FILE, [item.model_dump() for item in items])


def _find_user_by_id(users: list[User], user_id: str) -> Optional[User]:
    for user in users:
        if user.user_id == user_id:
            return user
    return None


def _find_note_by_id(notes: list[Note], user_id: str, note_id: str) -> Optional[Note]:
    for note in notes:
        if note.note_id == note_id and note.user_id == user_id:
            return note
    return None


def _find_group_by_id(groups: list[Group], user_id: str, group_id: str) -> Optional[Group]:
    for group in groups:
        if group.group_id == group_id and group.user_id == user_id:
            return group
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
        errors = [
            f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}"
            for err in exc.errors()
        ]
        raise HTTPException(status_code=422, detail={"validation_errors": errors})
    raise HTTPException(status_code=422, detail={"validation_errors": [str(exc)]})
