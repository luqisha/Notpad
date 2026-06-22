from uuid import UUID, uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.utils.data_loader import (
    load_notes,
    load_users,
    load_groups,
    save_groups,
    load_group_notes_list,
    save_group_notes_list,
    _find_user_by_id,
    _find_note_by_id,
    _find_group_by_id,
)
from app.utils.dependencies import require_user_id, verify_api_key
from app.schemas.group import Group, GroupCreate, GroupUpdate, GroupNotesItem
from app.schemas.note import Note
from app.schemas.user import User

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

    groups = [g for g in load_groups() if g.user_id == user_id]
    mappings = {item.group_id: item.note_ids for item in load_group_notes_list()}

    result = []
    for group in groups:
        group_data = group.model_dump()
        group_data["note_ids"] = mappings.get(group.group_id, [])
        result.append(group_data)

    return {"groups": result}


@router.get("/{group_id}")
@limiter.limit("120/minute")
def get_group(request: Request, group_id: str, user_id: str = Depends(require_user_id)):

    _validate_uuid(group_id, "group_id")

    groups = load_groups()
    existing = _find_group_by_id(groups, user_id, group_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Group not found")

    mappings = {item.group_id: item.note_ids for item in load_group_notes_list()}
    group_data = existing.model_dump()
    group_data["note_ids"] = mappings.get(existing.group_id, [])
    return {"group": group_data}


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
def create_group(request: Request, group: GroupCreate, user_id: str = Depends(require_user_id)):

    users = load_users()
    if not _find_user_by_id(users, user_id):
        raise HTTPException(status_code=404, detail="User not found")

    group_id = str(uuid4())
    group_obj = Group.model_validate({
        "group_id": group_id,
        "user_id": user_id,
        **group.model_dump(),
    })

    groups = load_groups()
    groups.append(group_obj)
    save_groups(groups)
    return {"message": "Group created successfully", "group": group_obj}


@router.patch("/{group_id}")
@limiter.limit("30/minute")
def update_group(request: Request, group_id: str, group: GroupUpdate, user_id: str = Depends(require_user_id)):

    _validate_uuid(group_id, "group_id")

    groups = load_groups()
    existing = _find_group_by_id(groups, user_id, group_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Group not found")

    updates = group.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = existing.model_copy(update=updates)

    for i, stored in enumerate(groups):
        if stored.group_id == group_id and stored.user_id == user_id:
            groups[i] = updated
            break

    save_groups(groups)
    return {"message": "Group updated successfully", "group": updated}


@router.delete("/{group_id}")
@limiter.limit("30/minute")
def delete_group(request: Request, group_id: str, user_id: str = Depends(require_user_id)):

    _validate_uuid(group_id, "group_id")

    groups = load_groups()
    existing = _find_group_by_id(groups, user_id, group_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Group not found")

    groups = [g for g in groups if not (g.group_id == group_id and g.user_id == user_id)]
    save_groups(groups)

    mappings = load_group_notes_list()
    mappings = [m for m in mappings if m.group_id != group_id]
    save_group_notes_list(mappings)

    return {"message": "Group deleted successfully"}


@router.post("/{group_id}/notes/{note_id}", status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
def create_group_note(request: Request, group_id: str, note_id: str, user_id: str = Depends(require_user_id)):

    _validate_uuid(group_id, "group_id")
    _validate_uuid(note_id, "note_id")

    groups = load_groups()
    if not _find_group_by_id(groups, user_id, group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    mappings = load_group_notes_list()
    for m in mappings:
        if m.group_id == group_id:
            if note_id in m.note_ids:
                raise HTTPException(status_code=409, detail="Note already in group")
            m.note_ids.append(note_id)
            save_group_notes_list(mappings)
            return {"message": "Note added to group", "mapping": m.model_dump()}

    new_item = GroupNotesItem.model_validate({"group_id": group_id, "note_ids": [note_id]})
    mappings.append(new_item)
    save_group_notes_list(mappings)
    return {"message": "Note added to group", "mapping": new_item.model_dump()}


@router.delete("/{group_id}/notes/{note_id}")
@limiter.limit("60/minute")
def delete_group_note(request: Request, group_id: str, note_id: str, user_id: str = Depends(require_user_id)):

    _validate_uuid(group_id, "group_id")
    _validate_uuid(note_id, "note_id")

    groups = load_groups()
    if not _find_group_by_id(groups, user_id, group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    mappings = load_group_notes_list()
    for m in mappings:
        if m.group_id == group_id:
            if note_id in m.note_ids:
                m.note_ids.remove(note_id)
                save_group_notes_list(mappings)
                return {"message": "Note removed from group", "mapping": m.model_dump()}
            raise HTTPException(status_code=404, detail="Note not in group")
    raise HTTPException(status_code=404, detail="Note not in group")
