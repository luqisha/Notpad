import json
from pathlib import Path

_DATA_DIR = Path(__file__).parent / "data"


def load_json(filename: str) -> list:
    with (_DATA_DIR / filename).open(encoding="utf-8") as f:
        return json.load(f)


USERS = load_json("user.json")
NOTES = load_json("note.json")
GROUPS = load_json("group.json")
NOTE_PICTURES = load_json("note_pictures.json")
NOTE_VOICES = load_json("note_voice.json")
GROUP_NOTES_LIST = load_json("group_notes_list.json")
