from uuid import UUID, uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

import app.utils.data_loader as dl
from app.utils.database import DBUser, DBGroup, DBNote
from app.utils.dependencies import require_user_id, verify_api_key
from app.schemas.group import GroupCreate, GroupUpdate

router = APIRouter(prefix="/groups", tags=["group"], redirect_slashes=False, dependencies=[Depends(verify_api_key)])

limiter = Limiter(key_func=get_remote_address)


def _validate_uuid(value: str, field: str = "id") -> None:
    try:
        UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {field}: {value}")


@router.get("")
@limiter.limit("120/minute")
def get_groups(request: Request, user_id: str = Depends(require_user_id)):
    groups, _ = dl.get_records(DBGroup, user_id=user_id)
    return {"groups": groups}


@router.get("/{group_id}")
@limiter.limit("120/minute")
def get_group(request: Request, group_id: str, user_id: str = Depends(require_user_id)):
    _validate_uuid(group_id, "group_id")
    group = dl.get_record(DBGroup, group_id=group_id, user_id=user_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"group": group}


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
def create_group(request: Request, group: GroupCreate, user_id: str = Depends(require_user_id)):
    if not dl.get_record(DBUser, user_id=user_id):
        raise HTTPException(status_code=404, detail="User not found")

    group_id = str(uuid4())
    group_obj = dl.create_record(DBGroup, group_id=group_id, user_id=user_id, name=group.name, description=group.description)
    return {"message": "Group created successfully", "group": group_obj}


@router.patch("/{group_id}")
@limiter.limit("30/minute")
def update_group(request: Request, group_id: str, group: GroupUpdate, user_id: str = Depends(require_user_id)):
    _validate_uuid(group_id, "group_id")

    existing = dl.get_record(DBGroup, group_id=group_id, user_id=user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Group not found")

    updates = group.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = dl.update_record(
        DBGroup,
        filter_kwargs={"group_id": group_id, "user_id": user_id},
        update_kwargs={"name": updates.get("name"), "description": updates.get("description")},
        raise_if_missing=True,
        missing_detail="Group not found"
    )
    return {"message": "Group updated successfully", "group": updated}


@router.delete("/{group_id}")
@limiter.limit("30/minute")
def delete_group(request: Request, group_id: str, user_id: str = Depends(require_user_id)):
    _validate_uuid(group_id, "group_id")

    existing = dl.get_record(DBGroup, group_id=group_id, user_id=user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Group not found")

    dl.delete_record(DBGroup, group_id=group_id, user_id=user_id)
    return {"message": "Group deleted successfully"}


@router.post("/{group_id}/notes/{note_id}", status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
def create_group_note(request: Request, group_id: str, note_id: str, user_id: str = Depends(require_user_id)):
    _validate_uuid(group_id, "group_id")
    _validate_uuid(note_id, "note_id")

    if not dl.get_record(DBGroup, group_id=group_id, user_id=user_id):
        raise HTTPException(status_code=404, detail="Group not found")

    if not dl.get_record(DBNote, note_id=note_id, user_id=user_id):
        raise HTTPException(status_code=404, detail="Note not found")

    try:
        mapping = dl.manage_group_note(group_id, note_id, user_id, "add")
    except Exception as e:
        raise HTTPException(status_code=409, detail=str(e))

    return {"message": "Note added to group", "mapping": mapping}


@router.delete("/{group_id}/notes/{note_id}")
@limiter.limit("60/minute")
def delete_group_note(request: Request, group_id: str, note_id: str, user_id: str = Depends(require_user_id)):
    _validate_uuid(group_id, "group_id")
    _validate_uuid(note_id, "note_id")

    if not dl.get_record(DBGroup, group_id=group_id, user_id=user_id):
        raise HTTPException(status_code=404, detail="Group not found")

    if not dl.get_record(DBNote, note_id=note_id, user_id=user_id):
        raise HTTPException(status_code=404, detail="Note not found")

    try:
        mapping = dl.manage_group_note(group_id, note_id, user_id, "remove")
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": "Note removed from group", "mapping": mapping}
