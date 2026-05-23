from fastapi import FastAPI

from app.routes import auth, notes, media, group

app = FastAPI(title="Notpad")

app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(media.router)
app.include_router(group.router)