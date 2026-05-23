from fastapi import APIRouter

router = APIRouter(tags=["group"])


@router.get("/groups")
def get_groups(user_id: str):
    return {"message": "Groups retrieved successfully"}

@router.post("/groups")
def create_group(user_id: str, name: str, description: str):
    return {"message": "Group created successfully"}

@router.patch("/groups/{group_id}")
def update_group(group_id: str, name: str, description: str):
    return {"message": "Group updated successfully"}

@router.delete("/groups/{group_id}")
def delete_group(group_id: str):
    return {"message": "Group deleted successfully"}

@router.post("/groups/{group_id}/notes")
def create_group_note(group_id: str, note_id: str):
    return {"message": "Group note created successfully"}

@router.delete("/groups/{group_id}/notes/{note_id}")
def delete_group_note(group_id: str, note_id: str):
    return {"message": "Group note deleted successfully"}