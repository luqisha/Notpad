# Notpad

A simple FastAPI starter project.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run

From the project root:

```bash
uvicorn app.main:app --reload
```

- API: http://127.0.0.1:8000
- Interactive docs: http://127.0.0.1:8000/docs

## Project layout

```
app/
  main.py          # FastAPI app, wires routers together
  routes/          # API endpoints (one file per area)
    health.py      # example routes
```

Add new route files under `app/routes/`, then register them in `app/main.py` with `app.include_router(...)`.
