import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.utils.data_loader import init_data_files
from app.routes import notes
from dotenv import load_dotenv

from app.routes import auth, group

init_data_files()
load_dotenv()


app = FastAPI(title="Notpad")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/uploads",
    StaticFiles(directory=Path(__file__).resolve().parent / "uploads", html=False),
    name="uploads",
)

app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(group.router)