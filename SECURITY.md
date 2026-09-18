# Security — Articles365 Backend

## Content protection model (TZ §6)

The platform's purpose is to distribute e-books **without** giving users the
original file. Controls:

1. **No public/permanent file URL.** Book source files live in a **private**
   S3-compatible bucket. Object keys are stored only in the DB and never returned
   to clients. Anonymous/direct bucket access is disabled (`mc anonymous set none`
   / never made public).
2. **API-proxied delivery.** `GET /api/v1/reader/{book_id}/content` streams bytes
   through the backend only after authorization, with HTTP Range support for the
   web reader. The default architecture is **backend-controlled delivery**, not
   presigned URLs, for maximum control (a presigned helper exists but is unused by
   default; if enabled it must be short-lived and access-checked first).
3. **Authorization before every byte.** `AccessService.ensure_read_access` runs
   before any storage read: authenticated ✚ account ACTIVE ✚ session valid ✚ book
   exists ✚ book ACTIVE ✚ ACTIVE `book_access` grant. Revocation takes effect
   immediately.
4. **Per-user watermark payload.** `GET /reader/{id}/watermark` returns a
   traceable, **HMAC-signed** label (short user ref + masked phone/email + trace
   id) so leaked screenshots are attributable, without exposing full PII. The
   client cannot forge another identity (signature over user/book/session).
5. **Response hardening.** Content responses set `Cache-Control: private,
   no-store`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`.
6. **Documented limitation (TZ §6, §16):** OS-level screenshots / external
   cameras cannot be technically prevented in a web platform. Protection is
   defense-in-depth: no direct file, per-request authorization, session/device
   control, and watermark traceability.

## OWASP-aligned controls

| Threat | Control |
|--------|---------|
| Broken access control / IDOR | Central `AccessService`; ownership-scoped queries (`AnnotationRepository.get_owned` filters by user **and** book; session revoke checks ownership). Server-side role checks on all `/admin/*`. Tests in `test_security_idor.py`. |
| Broken authentication | Argon2id password hashing (`RFC_9106_LOW_MEMORY`); short-lived JWT; rotating refresh tokens stored **hashed**; per-request session validation & revocation; account-status enforcement. |
| SQL injection | SQLAlchemy Core/ORM parameterized queries everywhere; full-text search uses bound `websearch_to_tsquery` params — no string interpolation. |
| Sensitive data exposure | Response schemas never include `password_hash`, `refresh_token_hash`, object keys, or secrets (admin book schema exposes `has_source_file`/`has_cover` booleans instead). Phone/email masked in watermark. |
| Unrestricted upload | Size limit enforced while streaming; content type detected from **magic bytes** (not extension); server-generated object keys `books/{uuid}/source.pdf` (no path traversal / user filename). Limits configurable. |
| Mass assignment | Explicit Pydantic Create/Update schemas; services set only whitelisted fields. |
| Brute force / credential stuffing | Redis-backed rate limits on login/register/refresh/OTP/search/reader (configurable), with per-process fallback. |
| SSRF / path traversal | No user-controlled outbound URLs; object keys are server-generated and validated by shape. |
| Information leakage | Global exception handler returns a stable error envelope; **no stack traces** to clients; unhandled errors logged with a correlation id and returned as generic `INTERNAL_ERROR`. |
| Transport security | HTTPS terminated at the ingress/reverse proxy in production (TZ §11); app trusts `X-Forwarded-For` for client IP. |
| CSRF | Token (Bearer) auth, not cookies, so CSRF is not applicable to the API; CORS origins are env-restricted and `*` must not be used with credentials in production. |

## Secrets & configuration

All secrets come from environment variables (`app/core/config.py`,
`.env.example`): `JWT_SECRET_KEY`, `WATERMARK_SECRET`, `S3_*`, `DATABASE_URL`.
None are committed. `.env` is git-ignored. Rotate `JWT_SECRET_KEY` to invalidate
all access tokens; sessions can be revoked individually or per user.

## Audit

Admin mutations (book/category/user/access/session changes) are recorded in
`admin_audit_logs` with actor, action, entity, non-sensitive metadata, IP and
timestamp. Audit records never contain secrets or tokens.
