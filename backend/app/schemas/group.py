from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class GroupBase(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    description: Optional[str] = Field(default="", max_length=1000)


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)


class Group(GroupBase):
    group_id: str
    user_id: str

    model_config = {"extra": "ignore"}

    @field_validator("group_id", "user_id")
    @classmethod
    def validate_uuid(cls, value: str) -> str:
        UUID(value)
        return value


class GroupNotesItem(BaseModel):
    group_id: str
    note_ids: List[str] = Field(default_factory=list)

    @field_validator("group_id")
    @classmethod
    def validate_uuid(cls, value: str) -> str:
        UUID(value)
        return value
