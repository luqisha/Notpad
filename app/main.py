import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import asyncio
import time
from fastapi.responses import PlainTextResponse, JSONResponse

from app.utils.data_loader import init_data_files
from app.routes import auth, notes, group

init_data_files()

app = FastAPI(title="Notpad")

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SESSION_SECRET"),
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

app.add_middleware(RateLimitMiddleware, limit=10, time_window=60)

class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, api_key: str):
        super().__init__(app)
        self.api_key = api_key

    async def dispatch(self, request, call_next):
        path = request.url.path or ""
        whitelist_prefixes = (
            "/docs",
        )

        if any(path.startswith(p) for p in whitelist_prefixes):
            return await call_next(request)


        api_key_header = request.headers.get("x-api-key") or request.headers.get("X-API-Key")

        if api_key_header != self.api_key:
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)

        return await call_next(request)

app.add_middleware(APIKeyAuthMiddleware, api_key=os.environ.get("API_KEY"))

app.mount(
    "/uploads",
    StaticFiles(directory=Path(__file__).resolve().parent / "uploads", html=False),
    name="uploads",
)

app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(group.router)