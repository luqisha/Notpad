from contextlib import contextmanager
from typing import Optional, Any, Type, Tuple, List
from fastapi import HTTPException

from app.schemas.note import Note, MediaReference
from app.schemas.user import User
from app.schemas.media import Voice, Picture
from app.utils.database import SessionLocal, DBUser, DBNote, DBGroup, DBPicture, DBVoice


@contextmanager
def db_session():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    from app.utils.database import Base, engine
    Base.metadata.create_all(bind=engine)


def _to_schema(db_obj: Any) -> Any:
    if not db_obj:
        return None
    if isinstance(db_obj, DBUser):
        return User(
            user_id=db_obj.user_id,
            user_mail=db_obj.user_mail,
            user_pass=db_obj.user_pass
        )
    elif isinstance(db_obj, DBNote):
        images = sorted(db_obj.images, key=lambda x: x.index)
        voices = sorted(db_obj.voices, key=lambda x: x.index)
        return Note(
            note_id=db_obj.note_id,
            user_id=db_obj.user_id,
            note_title=db_obj.note_title,
            note_body=db_obj.note_body,
            bg_color=db_obj.bg_color,
            is_pinned=db_obj.is_pinned,
            images=[MediaReference(index=img.index, id=img.picture_id) for img in images],
            voices=[MediaReference(index=v.index, id=v.voice_id) for v in voices]
        )
    elif isinstance(db_obj, DBPicture):
        return Picture(
            picture_id=db_obj.picture_id,
            note_id=db_obj.note_id,
            user_id=db_obj.user_id,
            picture_url=db_obj.picture_url,
            file_hash=db_obj.file_hash
        )
    elif isinstance(db_obj, DBVoice):
        return Voice(
            voice_id=db_obj.voice_id,
            note_id=db_obj.note_id,
            user_id=db_obj.user_id,
            voice_url=db_obj.voice_url
        )
    elif isinstance(db_obj, DBGroup):
        return {
            "group_id": db_obj.group_id,
            "user_id": db_obj.user_id,
            "name": db_obj.name,
            "description": db_obj.description,
            "note_ids": [n.note_id for n in db_obj.notes]
        }
    return db_obj


def get_record(model: Type[Any], **kwargs: Any) -> Any:
    with db_session() as db:
        db_obj = db.query(model).filter_by(**kwargs).first()
        return _to_schema(db_obj)


def get_records(
    model: Type[Any],
    order_by: Any = None,
    skip: int = 0,
    limit: int = 0,
    query_attr: Optional[str] = None,
    query: Optional[str] = None,
    **kwargs: Any
) -> Tuple[List[Any], int]:
    with db_session() as db:
        q = db.query(model).filter_by(**kwargs)
        if query and query_attr:
            normalized_query = query.strip().lower()
            q = q.filter(getattr(model, query_attr).ilike(f"%{normalized_query}%"))
        total = q.count()
        if order_by is not None:
            q = q.order_by(order_by)
        if limit > 0:
            q = q.offset(skip).limit(limit)
        return [_to_schema(x) for x in q.all()], total


def create_record(model: Type[Any], **kwargs: Any) -> Any:
    with db_session() as db:
        db_obj = model(**kwargs)
        db.add(db_obj)
        db.flush()
        return _to_schema(db_obj)


def update_record(
    model: Type[Any],
    filter_kwargs: dict,
    update_kwargs: dict,
    raise_if_missing: bool = False,
    missing_detail: str = "Record not found"
) -> Any:
    with db_session() as db:
        db_obj = db.query(model).filter_by(**filter_kwargs).first()
        if not db_obj:
            if raise_if_missing:
                raise HTTPException(status_code=404, detail=missing_detail)
            return None
        for k, v in update_kwargs.items():
            if v is not None:
                setattr(db_obj, k, v)
        db.flush()
        return _to_schema(db_obj)


def delete_record(model: Type[Any], **kwargs: Any) -> bool:
    with db_session() as db:
        db_obj = db.query(model).filter_by(**kwargs).first()
        if db_obj:
            db.delete(db_obj)
            return True
        return False


def manage_group_note(group_id: str, note_id: str, user_id: str, action: str) -> dict:
    with db_session() as db:
        g = db.query(DBGroup).filter(DBGroup.group_id == group_id, DBGroup.user_id == user_id).first()
        n = db.query(DBNote).filter(DBNote.note_id == note_id, DBNote.user_id == user_id).first()
        if not g or not n:
            raise Exception("Group or Note not found")
        if action == "add":
            if n in g.notes:
                raise Exception("Note already in group")
            g.notes.append(n)
        elif action == "remove":
            if n not in g.notes:
                raise Exception("Note not in group")
            g.notes.remove(n)
        db.flush()
        return {"group_id": g.group_id, "note_ids": [note.note_id for note in g.notes]}
