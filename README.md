# Articles365 — Backend

Protected e-book platform backend (FastAPI + PostgreSQL + S3-compatible storage).

The core principle (from the TZ): **original book files are never handed to the
client as a downloadable/public URL.** Books are read inside a web reader; every
page/byte is delivered through an authenticated, access-checked API proxy with a
per-user watermark payload, session control and admin-managed access grants.

> Scope: **backend only** (API, business logic, DB, storage, security, tests,
> Docker, docs). No frontend.

## Tech stack

Python 3.12 (runs on 3.11+) · FastAPI · Pydantic v2 · SQLAlchemy 2 (async) ·
PostgreSQL + asyncpg · Alembic · Redis (rate limiting) · S3-compatible object
storage (MinIO / AWS S3 / Cloudflare R2) via aioboto3 · PyMuPDF · Argon2id ·
pytest / httpx · Docker Compose.

## Quick start (Docker)

```bash
cp .env.example .env                     # adjust secrets for anything real
docker compose up -d postgres redis minio createbuckets
docker compose run --rm api alembic upgrade head
docker compose run --rm api python -m scripts.seed
docker compose up -d api
# API:      http://localhost:8001
# Swagger:  http://localhost:8001/docs
# MinIO UI: http://localhost:9101  (articles365 / articles365secret)
```

## Local development (venv)

```bash
# 1. Install deps
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"            # or: uv sync

# 2. Start infrastructure
docker compose up -d postgres redis minio createbuckets

# 3. Configure environment
cp .env.example .env

# 4. Run migrations
alembic upgrade head

# 5. Seed development data (admin + user + category + sample book)
python -m scripts.seed

# 6. Run the API
uvicorn app.main:app --reload --port 8001

# 7. Tests / lint / types
pytest -v
ruff check .
mypy app
```

### Development credentials (seed)

These are **development-only** defaults from `.env.example`; never reuse them in
production. Override via `SEED_*` env vars.

| Role  | Email                       | Password       |
|-------|-----------------------------|----------------|
| Admin | `admin@articles365.local`   | `Admin12345!`  |
| User  | `user@articles365.local`    | `User12345!`   |

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, modules, data flow
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — phased plan + status
- [`docs/REQUIREMENTS_TRACEABILITY.md`](docs/REQUIREMENTS_TRACEABILITY.md) — TZ → code map
- [`docs/API.md`](docs/API.md) — endpoint reference
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model & controls
- [`docs/STORAGE.md`](docs/STORAGE.md) — private storage & protected delivery
- [`docs/TESTING.md`](docs/TESTING.md) — test strategy & how to run
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment notes

## API surface (v1, prefix `/api/v1`)

Auth · Users (`/me`) · Library (`/library`) · Reader (`/reader/{id}`,
`/reader/{id}/content`, `/reader/{id}/watermark`) · Reading
(`/books/{id}/progress|annotations|search|toc`) · Sessions · Admin
(`/admin/users|books|categories|book-access|sessions|audit-logs`).

Health: `GET /health` (liveness), `GET /ready` (readiness).
