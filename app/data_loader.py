from pathlib import Path

from app.schemas.note import Note
from app.schemas.user import User
from app.utils.storage import read_file, write_file

_DATA_DIR = Path(__file__).parent / "data"
_USERS_FILE = _DATA_DIR / "user.json"
_NOTES_FILE = _DATA_DIR / "note.json"
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
