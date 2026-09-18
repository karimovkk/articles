# Implementation Plan & Status — Articles365 Backend

All phases complete. Verified via `pytest` (61 tests), `ruff`, `mypy`, a live
run against PostgreSQL + Redis + MinIO, and manual S3 Range verification.

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Spec analysis, architecture, project setup, config, Docker, PostgreSQL, Alembic | ✅ DONE |
| 2 | DB entities, repositories, base service infrastructure | ✅ DONE |
| 3 | Auth: JWT access + rotating refresh sessions, roles, user status | ✅ DONE |
| 4 | Users, categories, books, private object storage, secure file upload | ✅ DONE |
| 5 | BookAccess, My Library, admin access management, audit log | ✅ DONE |
| 6 | Protected Reader API, HTTP Range, book metadata, watermark payload | ✅ DONE |
| 7 | Reading progress, highlights, bookmarks, notes | ✅ DONE |
| 8 | PDF processing, text extraction, in-book search, TOC | ✅ DONE |
| 9 | Devices, sessions, revocation, configurable session limits | ✅ DONE |
| 10 | Security hardening: rate limiting, CORS, validation, error envelope | ✅ DONE |
| 11 | Tests: unit, integration, E2E, IDOR/security | ✅ DONE |
| 12 | Final QA: ruff, mypy, pytest, migration, live run, docs | ✅ DONE |

## Notable engineering notes / fixes made during the build

- **pydantic-settings + list env vars:** used `Annotated[list[str], NoDecode]`
  plus a CSV validator so `ALLOWED_ORIGINS=a,b` parses without JSON.
- **Async test event loops:** `NullPool` engine under `APP_ENV=test` and
  `asyncio_default_{fixture,test}_loop_scope=session` to avoid cross-loop reuse.
- **Streaming vs middleware:** the request-context middleware is **pure ASGI**;
  `BaseHTTPMiddleware` buffers bodies and breaks `StreamingResponse`/Range.
- **aiobotocore StreamingBody:** must iterate `resp["Body"].iter_chunks()`
  directly — entering it as an async context manager yields the raw aiohttp
  response (no `iter_chunks`). Fixed in `S3Storage`.
- **tsvector:** implemented as a Postgres **generated** column (`Computed`) with a
  GIN index, maintained by the DB — no triggers, excluded from ORM inserts.
- **mypy on this interpreter:** the local Python lacks `_sqlite3`, so
  `sqlite_cache = false` is set in `[tool.mypy]`.

## Deliberate scope decisions

- **Payments** (Click/Payme) not implemented — TZ §16 says access is granted
  manually after external payment confirmation. `BookAccess` is decoupled from
  any payment provider, leaving a clean integration seam.
- **OTP login** is not enabled; auth is password-based (Argon2id). The OTP
  delivery abstraction (`integrations/otp`) exists so phone/email OTP can be
  added without touching business logic.
- **Background workers** (Celery/Arq) not introduced — PDF processing is light
  and offloaded to a thread; the service boundary allows adding a queue later.
- **Frontend** intentionally not built (backend-only scope).
