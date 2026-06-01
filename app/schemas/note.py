import re
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

_HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class Note(BaseModel):
    note_id: str
    user_id: str
    note_title: str = Field(min_length=10, max_length=100)
    note_body: str = Field(max_length=1000)
    bg_color: str
    is_pinned: bool

    @field_validator("note_id", "user_id")
    @classmethod
    def validate_uuid(cls, value: str) -> str:
        UUID(value)
        return value

    @field_validator("bg_color")
    @classmethod
    def validate_bg_color(cls, value: str) -> str:
        if not _HEX_COLOR_PATTERN.match(value):
            raise ValueError("bg_color must be a 6-digit hex color (e.g. #FFFFFF)")
        return value.upper()
