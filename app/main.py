import os

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.utils.data_loader import init_data_files
from app.routes import auth, notes, media, group

init_data_files()

app = FastAPI(title="Notpad")

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET", "notpad-dev-session-secret"),
)

app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(media.router)
app.include_router(group.router)