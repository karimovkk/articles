# Testing — Articles365 Backend

## Stack

`pytest` + `pytest-asyncio` (auto mode) + `httpx.ASGITransport` (in-process ASGI,
no network). A dedicated PostgreSQL test database (`articles365_test`) is created
automatically; storage uses the in-memory backend and rate limiting is disabled
(`tests/conftest.py` sets the env before the app is imported).

## Layout

- `tests/unit/` — pure functions: Argon2id hashing, JWT, refresh-token hashing,
  HMAC watermark signing, masking, HTTP Range parsing.
- `tests/integration/` — API behavior via the ASGI client:
  - `test_auth.py` — register/login/refresh/logout/me, duplicate, invalid creds,
    identifier-required, phone login, invalid/expired/no token, blocked user.
  - `test_admin.py` — role enforcement, book CRUD, uploads (valid PDF, forbidden
    MIME, oversize), audit log, category CRUD + duplicate slug, no key leakage.
  - `test_reader.py` — access gating, full read, **Range 206**, suffix range,
    **invalid range 416**, unauthorized range, inactive book, watermark, revoke.
  - `test_reading.py` — library isolation/search/pagination, progress
    save/retrieve/validation, annotation lifecycle (highlight/bookmark/note),
    type validation, access requirement, in-book search + TOC, no-text-layer.
  - `test_sessions.py` — list, revoke current, session limit, admin revoke.
  - `test_security_idor.py` — cross-user annotation/session/progress isolation,
    cross-book annotation scoping, expired token.
- `tests/e2e/test_full_flow.py` — the **release-blocker** 22-step flow (TZ §48):
  admin → category → book → PDF upload → user → empty library → grant → library →
  reader metadata → content → progress → highlight/bookmark/note → list → revoke →
  content rejected.

## Run

```bash
pytest -v                      # full suite (needs the test PostgreSQL up)
pytest tests/e2e -v            # just the critical flow
ruff check .                   # lint (clean)
mypy app                       # type check (clean)
```

Infrastructure for tests: `docker compose up -d postgres` (MinIO/Redis not
required — memory storage + disabled rate limiting).

## Result (latest run)

- **pytest: 61 passed** (unit + integration + e2e).
- **ruff: All checks passed.**
- **mypy: Success, no issues in 97 source files.**

## Manual verification against real infrastructure

Because automated tests use the in-memory storage backend, the **S3 path** was
verified live against MinIO with the server running:

- Bucket auto-created on startup; `GET /ready` → `database/redis/storage: true`.
- Upload a real PDF → processed to `READY`, `page_count` correct.
- `Range: bytes=0-9` → `206`, `Content-Range: bytes 0-9/3054`, body `%PDF-`.
- Full `GET` → `200`, exact size, valid PDF.
- Invalid range → `416` with `Content-Range: bytes */3054`.
- In-book search returns the matching page with a highlighted snippet.

> Note: the S3/aiobotocore streaming body must be iterated via
> `resp["Body"].iter_chunks()` (not as an async context manager). An optional
> MinIO-backed integration test can be added behind an env flag for CI that has
> object storage available.
