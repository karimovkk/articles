# Deployment — Articles365 Backend

## Components

- **API** (this app) behind a TLS-terminating reverse proxy (nginx / Traefik /
  cloud LB). HTTPS is mandatory (TZ §11). Forward `X-Forwarded-For` and
  `X-Request-ID`.
- **PostgreSQL 16** (managed or container) with regular backups.
- **Redis 7** for rate limiting (recommended in production; the app falls back to
  a per-process limiter if absent, which is not correct across replicas).
- **S3-compatible object storage** — AWS S3, Cloudflare R2, or self-hosted MinIO.
  The bucket must be **private** (no public read/list).

## Configuration (env vars)

See `.env.example` for the full list. Production must set real values for:

| Variable | Notes |
|----------|-------|
| `APP_ENV` | `production` |
| `DEBUG` | `false` |
| `LOG_JSON` | `true` (structured logs) |
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/db` |
| `JWT_SECRET_KEY` | long random secret; rotating it invalidates all access tokens |
| `WATERMARK_SECRET` | long random secret |
| `REDIS_URL` | `redis://host:6379/0` |
| `S3_ENDPOINT_URL` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` / `S3_REGION` / `S3_USE_SSL` | storage credentials (never committed) |
| `ALLOWED_ORIGINS` | explicit origins (no `*` with credentials) |
| `MAX_BOOK_UPLOAD_SIZE`, `MAX_COVER_UPLOAD_SIZE` | upload limits |
| `MAX_ACTIVE_SESSIONS_PER_USER` | device/session cap |
| `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` | token lifetimes |

Secrets should come from a secrets manager / orchestrator env, not the image.

## Build & run

```bash
docker build -t articles365-backend:1.0.0 .

# Migrations (run once per release, before starting new app instances):
docker run --rm --env-file .env articles365-backend:1.0.0 alembic upgrade head

# Serve (scale horizontally behind the LB):
docker run -d --env-file .env -p 8000:8000 articles365-backend:1.0.0
# The image's default CMD runs uvicorn on 0.0.0.0:8000; front it with the proxy.
```

For multiple workers use a process manager or run several containers; keep one
Redis so rate limits are shared. Gunicorn+uvicorn workers is an option:
`gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4`.

## Database migrations

Alembic is the source of truth (no `create_all` in production).

```bash
alembic upgrade head            # apply
alembic revision --autogenerate -m "msg"   # author a change (review the diff!)
alembic downgrade -1            # roll back one
```

The initial migration creates all tables, the `book_page_texts` generated
`tsvector` column and its GIN index.

## Bootstrapping data

`python -m scripts.seed` creates a dev admin/user/category (guarded by `SEED_*`
env). In production, create the first admin via a one-off seeded run with strong
`SEED_ADMIN_PASSWORD`, then rely on the admin API.

## Health & observability

- Liveness: `GET /health`. Readiness (DB/Redis/storage): `GET /ready` — wire to
  the orchestrator's probes and the LB.
- Logs are structured (JSON when `LOG_JSON=true`) and carry `request_id`; ship to
  your log stack. Secrets/tokens/OTP are never logged.

## Scaling / performance notes

- Content is streamed with Range support; a large PDF is never buffered fully.
- Hot columns are indexed (`user_id`, `book_id`, `status`, `created_at`,
  `category_id`); library/admin lists paginate at the DB.
- PDF processing runs in a worker thread on upload; for very large corpora
  introduce a task queue (Arq/Celery) at the existing `BookService` seam.
