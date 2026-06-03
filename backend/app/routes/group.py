from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import ValidationError

from app.utils.data_loader import (
    load_notes,
    load_users,
    load_groups,
    save_groups,
    load_group_notes_list,
    save_group_notes_list,
)
from app.utils.dependencies import get_logged_in_user_id
from app.schemas.group import Group, GroupCreate, GroupUpdate, GroupNotesItem
from app.schemas.note import Note
from app.schemas.user import User

router = APIRouter(prefix="/groups", tags=["group"])


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


def _find_user_by_id(users: list[User], user_id: str) -> Optional[User]:
    for user in users:
        if user.user_id == user_id:
            return user
    return None


def _raise_validation_error(exc: Exception) -> None:
    if isinstance(exc, ValidationError):
        errors = [
            f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}"
            for err in exc.errors()
        ]
        raise HTTPException(status_code=422, detail={"validation_errors": errors})
    raise HTTPException(status_code=422, detail={"validation_errors": [str(exc)]})


@router.get("/")
def get_groups(request: Request):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    groups = [g for g in load_groups() if g.user_id == user_id]
    mappings = {item.group_id: item.note_ids for item in load_group_notes_list()}

    result = []
    for group in groups:
        group_data = group.model_dump()
        group_data["note_ids"] = mappings.get(group.group_id, [])
        result.append(group_data)

    return {"groups": result}


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_group(request: Request, group: GroupCreate):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    users = load_users()
    if not _find_user_by_id(users, user_id):
        raise HTTPException(status_code=404, detail="User not found")

    group_id = str(uuid4())
    try:
        group_obj = Group.model_validate({
            "group_id": group_id,
            "user_id": user_id,
            **group.model_dump(),
        })
    except (ValidationError, ValueError) as exc:
        _raise_validation_error(exc)

    groups = load_groups()
    groups.append(group_obj)
    save_groups(groups)
    return {"message": "Group created successfully", "group": group_obj}


@router.patch("/{group_id}")
def update_group(request: Request, group_id: str, group: GroupUpdate):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    groups = load_groups()
    existing = _find_group_by_id(groups, user_id, group_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Group not found")

    updates = group.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        updated = existing.model_copy(update=updates)
    except ValidationError as exc:
        _raise_validation_error(exc)

    for i, stored in enumerate(groups):
        if stored.group_id == group_id and stored.user_id == user_id:
            groups[i] = updated
            break

    save_groups(groups)
    return {"message": "Group updated successfully", "group": updated}


@router.delete("/{group_id}")
def delete_group(request: Request, group_id: str):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

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


@router.post("/{group_id}/notes", status_code=status.HTTP_201_CREATED)
def create_group_note(request: Request, group_id: str, note_id: str):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

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
def delete_group_note(request: Request, group_id: str, note_id: str):
    user_id = get_logged_in_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    groups = load_groups()
    if not _find_group_by_id(groups, user_id, group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    notes = load_notes()
    if not _find_note_by_id(notes, user_id, note_id):
        raise HTTPException(status_code=404, detail="Note not found")

    mappings = load_group_notes_list()
    for m in mappings:
        if m.group_id == group_id:
            if note_id not in m.note_ids:
                raise HTTPException(status_code=404, detail="Note not in group")
            m.note_ids.remove(note_id)
            save_group_notes_list(mappings)
            return {"message": "Note removed from group", "mapping": m.model_dump()}
    raise HTTPException(status_code=404, detail="Group mapping not found")
