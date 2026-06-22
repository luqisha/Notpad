import re
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

_HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class MediaReference(BaseModel):
    """Reference to media (image or voice) within a note"""
    index: int
    id: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        UUID(value)
        return value


class NoteBase(BaseModel):
    note_title: str = Field(min_length=1, max_length=100)
    note_body: str = Field(min_length=1, max_length=1000)
    bg_color: str = Field(default="#FFFFFF")
    is_pinned: bool = False

    @field_validator("bg_color")
    @classmethod
    def validate_bg_color(cls, value: str) -> str:
        if not _HEX_COLOR_PATTERN.match(value):
            raise ValueError("bg_color must be a 6-digit hex color (e.g. #FFFFFF)")
        return value.upper()


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    note_title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    note_body: Optional[str] = None
    bg_color: Optional[str] = None
    is_pinned: Optional[bool] = None

    @field_validator("bg_color")
    @classmethod
    def validate_bg_color(cls, value: str) -> str:
        if not _HEX_COLOR_PATTERN.match(value):
            raise ValueError("bg_color must be a 6-digit hex color (e.g. #FFFFFF)")
        return value.upper()


class Note(NoteBase):
    note_id: str
    user_id: str
    images: list[MediaReference] = Field(default_factory=list)
    voices: list[MediaReference] = Field(default_factory=list)

    model_config = {"extra": "ignore"}

    @field_validator("note_id", "user_id")
    @classmethod
    def validate_uuid(cls, value: str) -> str:
        UUID(value)
        return value
