# Notpad — RESTructuring & Refactoring TODO

This todo list serves as a roadmap for the backend refactoring process. It outlines what has been done, what needs immediate fixing based on development best practices, and **why** these changes are important using simple, clear explanations.

---

## 🚀 Completed Tasks
- [x] **1. Proper HTTP Status Codes**
  - **What was done:** Updated routes to use FastAPI's `HTTPException` with proper semantic HTTP codes (401, 404, 409, 400).
  - **Why we did it:** Standard HTTP status codes allow front-end clients (like web pages or mobile apps) to understand the result of a request immediately without parsing custom message text.

---

## 🛠️ In-Progress / Refactoring Tasks (High Priority)

### [ ] **2. Correct Auth Dependency via `Depends()`**
- **File:** `app/utils/dependencies.py` and routers
- **What's needed:** Refactor authentication to use FastAPI's dependency injection container instead of manual route-level session checks.
  ```python
  def require_user_id(request: Request) -> str:
      user_id = request.session.get("user_id")
      if not user_id:
          raise HTTPException(status_code=401, detail="Not logged in")
      return str(user_id)
  ```
  *Use in routers:* `def get_notes(user_id: str = Depends(require_user_id))`
- **Why we are doing this:** 
  * **Code Duplication (DRY - Don't Repeat Yourself):** Removes repetitive manual checks from the start of every authenticated route.
  * **Testability:** Allows easy mocking of users in automated tests without dealing with real session cookies.

### [ ] **3. OpenAPI-Compatible API Key Authentication**
- **File:** `app/main.py` and `app/utils/dependencies.py`
- **What's needed:** Replace the custom middleware check for `X-API-Key` with FastAPI's native `APIKeyHeader` security scheme.
  ```python
  api_key_header = APIKeyHeader(name="X-API-Key")
  def verify_api_key(api_key: str = Depends(api_key_header)):
      if api_key != os.environ.get("API_KEY"):
          raise HTTPException(status_code=403, detail="Invalid API Key")
  ```
- **Why we are doing this:**
  * **Interactive Docs:** Native security adds an auth lock button to the Swagger UI (`/docs`), making testing easier.
  * **No Path Whitelisting:** 
    * *The Problem:* Custom middleware runs blindly on *every* incoming HTTP request. Because of this, it blocks access to critical public paths like the documentation pages (`/docs`, `/redoc`) and the OpenAPI schema (`/openapi.json`). To prevent this, you have to manually maintain a whitelist of allowed paths inside the middleware code (e.g., `if request.url.path in ["/docs", "/openapi.json"]: proceed`).
    * *The Solution:* Using FastAPI's native `Depends()` dependency injection means you only attach security checking to the specific routers and routes that actually need it. The documentation endpoints are left naturally unsecured without requiring a manually maintained whitelist.

### [ ] **4. Deduplicate Helper Functions**
- **Files:** `app/routes/notes.py`, `app/routes/group.py`
- **What's needed:** Move duplicate helpers (like `_find_note_by_id`) to a shared module (e.g., `app/utils/data_loader.py`).
- **Why we are doing this:**
  * **Maintainability:** Ensures retrieval and error-handling logic are updated in a single place to prevent out-of-sync bugs.

### [ ] **5. Clean Up Redundant Validation inside Routers**
- **Files:** `app/routes/auth.py`, `app/routes/notes.py`, `app/routes/group.py`
- **What's needed:** Remove manual `try...except ValidationError` blocks from router functions.
- **Why we are doing this:**
  * **Redundancy:** FastAPI uses Pydantic to validate input schemas automatically, making manual router-level validation blocks dead code.

---

## 🔒 Security & Performance Optimizations (Medium Priority)

### [ ] **6. Switch Custom Rate Limiter to `slowapi`**
- **File:** `app/main.py`
- **What's needed:** Install `slowapi` and replace the custom middleware limiter.
  
  **How to implement it:**
  1. Run `pip install slowapi`.
  2. Setup the limiter in `main.py` and register the rate-limit exception handler:
     ```python
     from slowapi import Limiter, _rate_limit_exceeded_handler
     from slowapi.util import get_remote_address
     from slowapi.errors import RateLimitExceeded

     limiter = Limiter(key_func=get_remote_address)
     app.state.limiter = limiter
     app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
     ```
  3. Limit specific pages using Python decorators:
     ```python
     @router.post("/login")
     @limiter.limit("5/minute")
     def login(request: Request, credentials: UserCreate):
         ...
     ```
- **Why we are doing this:**
  * **Eliminate Memory Leaks & Bottlenecks:** The current custom rate limiter stores IP logs in memory indefinitely (a memory leak) and forces all incoming requests to wait in a single-file line, which slows down the application for everyone (a performance bottleneck).
  * **Granular & Concurrency-Safe Limiting:** `slowapi` is concurrency-safe, handles automatic key cleanup, and allows specifying custom limits on a per-route basis easily via decorators.

### [ ] **7. Async File Operations (Event Loop Safety)**
- **Files:** `app/utils/storage.py`, `app/routes/notes.py`
- **What's needed:** Wrap synchronous file I/O operations (`json.load`, `json.dump`, `shutil.copyfileobj`) in an async executor using `anyio.to_thread.run_sync` or use `aiofiles`.
- **Why we are doing this:**
  * **What is the Event Loop?** The Event Loop is FastAPI's single-threaded core engine that runs tasks, handles incoming requests, and switches between tasks when they are waiting for external operations (like database queries or disk access).
  * **The Waiter Analogy:** Think of FastAPI as a single busy restaurant waiter.
    * *Blocking (Synchronous):* The waiter takes a customer's order for steak. Instead of serving other tables, the waiter stands in the kitchen waiting for the chef to cook the steak. No one else can get water or order food until that steak is finished.
    * *Non-blocking (Asynchronous):* The waiter takes the steak order, passes it to the kitchen, and immediately goes to serve other tables. When the kitchen rings a bell, the waiter pauses and serves the steak.
  * **Applying to Code:** Standard file reading/writing is a synchronous, blocking task (waiting for the steak). If the server is busy writing a file, it cannot respond to any other user. Running it asynchronously lets the event loop continue serving other users while the file system works in the background.

### [ ] **8. Concurrency-Safe & Atomic Storage (or SQLite Transition)**
- **File:** `app/utils/storage.py`
- **What's needed:** Protect the file-based database from corruption and race conditions under concurrent use by different API requests.
  1. **Short-Term JSON Mitigation:**
     * **Atomic Writes:** Rewrite the `write_file` function to dump JSON data into a temporary file first, and then swap it with the original file (`os.replace`).
       ```python
       import tempfile
       import os
       from pathlib import Path
       from typing import Any, Union
       import json

       def write_file(path: Union[str, Path], data: Any) -> None:
           path = Path(path)
           path.parent.mkdir(parents=True, exist_ok=True)
           dir_name = path.parent
           with tempfile.NamedTemporaryFile("w", dir=dir_name, delete=False, encoding="utf-8") as temp_file:
               json.dump(data, temp_file, indent=2)
               temp_file.write("\n")
               temp_file_path = temp_file.name
           try:
               os.replace(temp_file_path, path)
           except Exception as e:
               if os.path.exists(temp_file_path):
                   os.remove(temp_file_path)
               raise e
       ```
     * **Locking & Caching:** Load the JSON files into memory once on startup. Perform reads from memory. Use an `asyncio.Lock` when writing to ensure only one request modifies the file at any given moment.
  2. **Long-Term Database Transition (Recommended):**
     * Migrate the storage layer to an actual Database (using SQLAlchemy or SQLModel) to handle caching, atomic transactions, and concurrent locking automatically.
- **Why we are doing this:**
  * **Prevent Corrupted Data:** When you write directly to a file, the system opens it and writes data line by line. If the server loses power, crashes, or runs out of storage space in the middle of writing, the file gets cut in half and becomes corrupted (unreadable JSON). By writing to a temporary file first and doing a rename, the swap happens instantly. Even if the server crashes mid-write, it only damages the temp file, leaving the main database file untouched and safe.
  * **Race Conditions (Lost Updates):** If User A and User B save a note at the exact same millisecond:
    1. Both read the JSON file at the same time (finding 10 notes).
    2. User A adds Note 11 and writes it back (file has 11 notes).
    3. User B adds Note 12 to the 10 notes they read, and writes it back. This overwrites the file, completely erasing Note 11!
    Using `asyncio.Lock` and memory caching (or database transactions) prevents this issue.

### [ ] **9. Uploaded File & MIME-Type Validation**
- **File:** `app/routes/notes.py`
- **What's needed:** Implement file validation checking for `file.content_type` (MIME-type), inspect file headers (e.g. using `python-magic`), and enforce a maximum file size limit.
- **Why we are doing this:**
  * **Security Vulnerabilities:** Relying on the filename extension is insecure. A hacker can rename a malicious script (like `shell.py`) to `image.jpg` and upload it.
  * **Denial of Service (DoS):** Without file size limits, an attacker can upload a 10GB file, filling up server storage and crashing the application.

---

## ⚡ Next Steps / Architecture Enhancements (Future Roadmap)

### [ ] **10. Centralized Config via Pydantic Settings**
- **File:** Create `app/core/config.py`
- **What's needed:** Use `pydantic-settings` to load and validate environment variables at startup.
- **Why we are doing this:**
  * **Fail-Fast Boot:** Ensures the application fails immediately if critical environment variables are missing.

### [ ] **11. CORS Middleware Configuration**
- **File:** `app/main.py`
- **What's needed:** Configure `CORSMiddleware` to define explicitly allowed frontend origins.
- **Why we are doing this:**
  * **Browser Security:** Enables secure communication between the frontend and backend without browser-level blocking.

### [ ] **12. Write Unit & Integration Tests**
- **What's needed:** Use `pytest` to write automated tests for auth, routers, and storage.
- **Why we are doing this:**
  * **Refactoring Confidence:** Provides a safety net to ensure that optimizations or new features do not break existing functionality.
