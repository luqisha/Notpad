from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class User(BaseModel):
    user_id: str
    user_mail: EmailStr
    user_pass: str = Field(min_length=1)

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, value: str) -> str:
        UUID(value)
        return value


class UserCreate(BaseModel):
    user_mail: EmailStr
    password: str = Field(min_length=8, max_length=128)
