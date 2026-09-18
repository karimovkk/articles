# Architecture — Articles365 Backend

## Style

A **modular monolith** (single deployable FastAPI app) with clean horizontal
layers. No microservices — the TZ scope does not warrant that complexity.

```
HTTP client (future web reader / mobile)
        │
   ┌────▼─────────────────────────────────────────────┐
   │ API layer      app/api/**  (thin routers)         │  request/response, auth deps,
   │                app/api/deps.py, errors.py          │  rate limiting, error envelope
   ├────────────────────────────────────────────────── ┤
   │ Service layer  app/services/**                     │  business logic, transactions,
   │                                                    │  authorization, audit
   ├─────────────────────────────────────────────────  ┤
   │ Persistence    app/db/repositories/**, models/**   │  SQLAlchemy 2 async, queries
   ├─────────────────────────────────────────────────  ┤
   │ Integrations   app/integrations/** (storage/otp)   │  S3, OTP/email abstractions
   └─────────────────────────────────────────────────  ┘
        │                         │
   PostgreSQL (asyncpg)     S3-compatible object storage
   Redis (rate limiting)
```

### Layer rules

- **Routers are thin.** They parse/validate input (Pydantic), call one service,
  and serialize the result. No business logic, no direct SQL.
- **Services own business logic and transactions.** They depend on repositories
  and integrations, never on FastAPI request objects. They raise domain
  exceptions (`app/core/exceptions.py`), never `HTTPException`.
- **Repositories own data access.** They build/execute SQLAlchemy statements and
  return models. Reusable pagination lives in `BaseRepository`.
- **Integrations** hide external systems behind interfaces (`StorageService`,
  `OTPProvider`, `EmailSender`) selected by config, enabling MinIO ↔ S3 ↔ R2 and
  future OTP without touching business code.

## Request lifecycle

1. `RequestContextMiddleware` (pure ASGI) assigns a correlation id, logs the
   request, and adds `X-Request-ID`. Pure ASGI (not `BaseHTTPMiddleware`) so it
   never buffers streaming/Range responses.
2. CORS middleware (env-driven origins).
3. Dependencies resolve: `get_db` (one shared `AsyncSession` per request, cached
   by FastAPI), `get_auth_context` (decode JWT → validate session not
   revoked/expired → load user → assert ACTIVE), `require_admin`, `rate_limit`.
4. Router calls a service; the service commits its own transaction.
5. Domain exceptions are mapped to the standard envelope by `app/api/errors.py`.

## Key design decisions

- **Auth:** short-lived JWT **access token** (default 15 min, HS256, carrying
  `sub`, `sid`, `role`) + opaque **refresh token** stored only as a SHA-256 hash
  in `sessions`. Refresh **rotates** the token; the session row is the unit of
  revocation. Access tokens are validated against the live session on every
  request, so a revoked session is rejected immediately despite the JWT still
  being unexpired.
- **Central authorization:** `AccessService.ensure_read_access(user_id, book_id)`
  is the single gate for all protected book data (metadata, content, watermark,
  progress, annotations, search, toc). It checks book existence, `book.status`,
  and an ACTIVE `book_access` row keyed on the authenticated user — preventing
  IDOR by construction.
- **Protected delivery:** book bytes are streamed from private object storage by
  an authenticated API proxy with HTTP Range support. No presigned/public URL is
  ever handed out (see `docs/STORAGE.md`, `docs/SECURITY.md`).
- **Storage abstraction:** `StorageService` with `S3Storage` (aioboto3, works for
  MinIO/S3/R2) and `MemoryStorage` (tests/offline). Range reads stream chunk by
  chunk — a 500 MB PDF is never loaded into memory.
- **PDF processing:** synchronous but offloaded to a worker thread
  (`anyio.to_thread`) on upload; extracts page count, metadata, TOC and per-page
  text. Book states: UPLOADING → PROCESSING → READY / FAILED. The design leaves a
  seam for Celery/Arq if heavier processing is later required.
- **Search:** per-page text in `book_page_texts` with a Postgres **generated**
  `tsvector` column + GIN index; queried with parameterized
  `websearch_to_tsquery` (injection-safe). Image-only PDFs report
  `text_available=false` rather than faking results.

## Data model

See `docs/REQUIREMENTS_TRACEABILITY.md` and `alembic/versions/` for the exact
schema. Entities: `users`, `categories`, `books`, `book_page_texts`,
`book_access`, `reading_progress`, `annotations`, `sessions`, `devices`,
`admin_audit_logs`. UUID PKs, FKs with appropriate `ON DELETE`, unique
constraints on `(user_id, book_id)` for access/progress, timestamps, JSONB for
metadata/locations.

## Modules

`app/core` (config, security, logging, exceptions, permissions, redis, rate
limit) · `app/db` (base, session, models, repositories) · `app/schemas` (Pydantic
v2 request/response) · `app/services` (business logic) · `app/integrations`
(storage, otp, email) · `app/api` (routers, deps, errors, health) ·
`app/middleware` · `app/utils` (pdf, http_range, uploads, files, masking).
