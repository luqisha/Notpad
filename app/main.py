import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.utils.data_loader import init_data_files
from app.routes import auth, notes, group

init_data_files()

app = FastAPI(title="Notpad")

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET", "notpad-dev-session-secret"),
)

app.mount(
    "/uploads",
    StaticFiles(directory=Path(__file__).resolve().parent / "uploads", html=False),
    name="uploads",
)

app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(group.router)