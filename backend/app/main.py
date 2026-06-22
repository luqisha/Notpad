import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import asyncio
import time
from fastapi.responses import PlainTextResponse

from app.utils.data_loader import init_data_files
from app.routes import notes
from dotenv import load_dotenv

from app.routes import auth, group

init_data_files()
load_dotenv()


app = FastAPI(title="Notpad")

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

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int, time_window: int):
        super().__init__(app)
        self.limit = limit
        self.time_window = time_window
        self.clients: dict[str, tuple[int, float]] = {}
        self.lock = asyncio.Lock()

    async def dispatch(self, request, call_next):
        client = request.client.host if request.client else "unknown"
        now = time.time()
        async with self.lock:
            count, start = self.clients.get(client, (0, now))
            if now - start > self.time_window:
                count = 0
                start = now
            if count >= self.limit:
                return PlainTextResponse("Too Many Requests", status_code=429)
            count += 1
            self.clients[client] = (count, start)

        response = await call_next(request)
        return response

app.add_middleware(RateLimitMiddleware, limit=60, time_window=1)

app.mount(
    "/uploads",
    StaticFiles(directory=Path(__file__).resolve().parent / "uploads", html=False),
    name="uploads",
)

app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(group.router)