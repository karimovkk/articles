# API Reference — Articles365 Backend

Base prefix: `/api/v1`. Interactive docs: **`/docs`** (Swagger) and **`/redoc`**;
machine spec at **`/openapi.json`**. Auth: `Authorization: Bearer <access_token>`.

## Conventions

- **Pagination** (list endpoints): query `page` (≥1), `page_size` (1–100).
  Response envelope: `{ "items": [...], "page", "page_size", "total", "pages" }`.
- **Errors**: `{ "error": { "code", "message", "details" } }`, correct HTTP
  status. Common codes: `AUTHENTICATION_REQUIRED` (401), `INVALID_CREDENTIALS`
  (401), `SESSION_REVOKED` (401), `PERMISSION_DENIED` (403), `ACCOUNT_INACTIVE`
  (403), `BOOK_ACCESS_DENIED` (403), `*_NOT_FOUND` (404), `ALREADY_EXISTS` (409),
  `VALIDATION_ERROR` (422), `PAYLOAD_TOO_LARGE` (413), `RANGE_NOT_SATISFIABLE`
  (416), `RATE_LIMIT_EXCEEDED` (429).
- **Device header** (optional): `X-Device-Id` ties a session to a device.

## Health

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Liveness: `{"status":"ok"}` |
| GET | `/ready` | Readiness: checks DB, Redis, storage |

## Auth & profile

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/v1/auth/register` | — | Register with `email` or `phone` + `password` |
| POST | `/api/v1/auth/login` | — | Returns access + refresh tokens + user |
| POST | `/api/v1/auth/refresh` | — | Rotate refresh token, new access token |
| POST | `/api/v1/auth/logout` | Bearer | Revoke current/refresh session |
| GET | `/api/v1/auth/me` | Bearer | Current user |
| GET | `/api/v1/me` | Bearer | Current user |
| PATCH | `/api/v1/me` | Bearer | Update own profile (`full_name`) |

## Library

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/library` | Bearer | Books granted to the user. Query: `search`, `category_id`, `sort` (`granted`\|`title`\|`recent`), pagination |

## Reader (protected content)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/reader/{book_id}` | Bearer + access | Reader metadata (page count, progress, features) |
| GET | `/api/v1/reader/{book_id}/content` | Bearer + access | Protected content stream; supports `Range` (200/206/416) |
| GET | `/api/v1/reader/{book_id}/cover` | Bearer + access | Cover image |
| GET | `/api/v1/reader/{book_id}/watermark` | Bearer + access | Signed watermark payload |

## Reading data

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET / PUT | `/api/v1/books/{book_id}/progress` | Bearer + access | Get / upsert reading progress |
| GET / POST | `/api/v1/books/{book_id}/annotations` | Bearer + access | List (filter `type`) / create annotation |
| PATCH / DELETE | `/api/v1/books/{book_id}/annotations/{annotation_id}` | Bearer + access + owner | Update / delete own annotation |
| GET | `/api/v1/books/{book_id}/search?q=` | Bearer + access | In-book full-text search |
| GET | `/api/v1/books/{book_id}/toc` | Bearer + access | Table of contents |

## Sessions

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/sessions` | Bearer | List own sessions (`is_current` flag) |
| DELETE | `/api/v1/sessions/{session_id}` | Bearer + owner | Revoke own session |

## Admin (`ADMIN` role required on every route)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/admin/users` | List/search users (`search`, `status`, pagination) |
| GET | `/api/v1/admin/users/{user_id}` | User detail |
| PATCH | `/api/v1/admin/users/{user_id}/status` | Activate / deactivate / block |
| GET | `/api/v1/admin/users/{user_id}/books` | User's access records |
| GET | `/api/v1/admin/users/{user_id}/sessions` | User's sessions |
| GET / POST | `/api/v1/admin/books` | List / create book |
| GET / PATCH | `/api/v1/admin/books/{book_id}` | Detail / update (incl. status) |
| POST | `/api/v1/admin/books/{book_id}/file` | Upload source PDF (multipart `file`) |
| POST | `/api/v1/admin/books/{book_id}/cover` | Upload cover (multipart `file`) |
| GET / POST | `/api/v1/admin/categories` | List / create category |
| PATCH | `/api/v1/admin/categories/{category_id}` | Update / (de)activate category |
| GET / POST | `/api/v1/admin/book-access` | List / grant access (idempotent) |
| POST | `/api/v1/admin/book-access/{access_id}/revoke` | Revoke access (keeps history) |
| DELETE | `/api/v1/admin/book-access/{access_id}` | Revoke (alias of revoke) |
| DELETE | `/api/v1/admin/sessions/{session_id}` | Revoke any user's session |
| GET | `/api/v1/admin/audit-logs` | Audit log (`admin_id`, `action`, `entity_type`, pagination) |

## Example: Range request

```
GET /api/v1/reader/{book_id}/content
Authorization: Bearer <token>
Range: bytes=0-1048575

HTTP/1.1 206 Partial Content
Accept-Ranges: bytes
Content-Range: bytes 0-1048575/5242880
Content-Length: 1048576
Content-Type: application/pdf
Cache-Control: private, no-store, max-age=0
```
