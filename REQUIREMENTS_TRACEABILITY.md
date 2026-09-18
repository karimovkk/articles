# Requirements Traceability — Articles365 Backend

Maps every **backend** requirement extracted from the TZ
(`Articles365_Texnik_Topshiriq_Cognilabs`) to the API, database, service and
tests that implement it. Frontend-only requirements (TZ §9, reading-mode UI,
responsive UI) are explicitly out of scope.

Status legend: **DONE** · IN PROGRESS · TODO · BLOCKED

| # | Requirement (TZ ref) | API | Database | Service | Tests | Status |
|---|----------------------|-----|----------|---------|-------|--------|
| 1 | Registration & login via email **or** phone (TZ §4.1, §5.1) | `POST /auth/register`, `POST /auth/login` | `users` | `AuthService.register/authenticate` | `test_auth.py` | DONE |
| 2 | Passwords hashed, never plaintext (TZ §5.1, §11) | — | `users.password_hash` | `core.security` (Argon2id) | `test_units.py::test_password_hash_is_argon2id_and_verifies` | DONE |
| 3 | Personal cabinet / profile (TZ §4.1) | `GET/PATCH /me`, `GET /auth/me` | `users` | `UserService.update_profile` | `test_auth.py::test_register_and_me` | DONE |
| 4 | Session tokens & management (TZ §4.1, §8) | `POST /auth/refresh`, `POST /auth/logout`, `GET /sessions` | `sessions`, `devices` | `AuthService`, `SessionService` | `test_sessions.py`, `test_auth.py` | DONE |
| 5 | Inactive/blocked account cannot use protected resources (TZ §5.1, §8) | dependency `get_auth_context` | `users.status` | `core.permissions.ensure_active` | `test_auth.py::test_blocked_user_denied` | DONE |
| 6 | Role separation USER/ADMIN, server-enforced (TZ §3.1, §11) | `require_admin` dep on all `/admin/*` | `users.role` | `core.permissions.ensure_admin` | `test_admin.py::test_user_cannot_access_admin_routes` | DONE |
| 7 | "My Library" — only granted books (TZ §4.2, §5.2) | `GET /library` | `book_access`, `books`, `reading_progress` | `LibraryService` | `test_reading.py::test_library_only_returns_assigned_books` | DONE |
| 8 | Library shows cover/author/summary/progress (TZ §5.2) | `GET /library`, `GET /reader/{id}/cover` | `books`, `reading_progress` | `LibraryService` | `test_reading.py`, e2e | DONE |
| 9 | Protected reading — no permanent public file URL (TZ §3, §5.3, §6) | `GET /reader/{id}/content` (API proxy) | `books.source_object_key` (private) | `ReaderService.prepare_content` + `StorageService` | `test_reader.py`, e2e | DONE |
| 10 | Per-request access check before content (TZ §6, §11) | `ReaderService`/`AccessService.ensure_read_access` | `book_access.status` | `AccessService` | `test_reader.py::test_user_without_access_denied` | DONE |
| 11 | HTTP Range / partial content for large PDFs (TZ §12) | `GET /reader/{id}/content` (206/416) | — | `utils.http_range`, `StorageService.stream_range` | `test_reader.py::test_range_request_returns_206`, `test_units.py` | DONE |
| 12 | Highlights (TZ §4.4, §5) | `POST/PATCH/DELETE /books/{id}/annotations` | `annotations` (HIGHLIGHT) | `AnnotationService` | `test_reading.py::test_annotation_lifecycle` | DONE |
| 13 | Bookmarks (TZ §4.5) | annotations API (BOOKMARK) | `annotations` | `AnnotationService` | `test_reading.py`, e2e | DONE |
| 14 | Personal notes (TZ §4.6) | annotations API (NOTE) | `annotations` | `AnnotationService` | `test_reading.py`, e2e | DONE |
| 15 | Reading progress: save/resume, % (TZ §4.7, §5.3) | `GET/PUT /books/{id}/progress` | `reading_progress` (uq user+book) | `ProgressService.upsert` | `test_reading.py::test_progress_save_and_retrieve` | DONE |
| 16 | In-book search when text layer exists (TZ §4.8, §16) | `GET /books/{id}/search` | `book_page_texts` + tsvector GIN | `ReaderService.search` | `test_reading.py::test_search_and_toc`, `test_search_no_text_layer` | DONE |
| 17 | Table of contents when present (TZ §4.8) | `GET /books/{id}/toc` | `books.toc` (JSONB) | `ReaderService.get_toc` | `test_reading.py::test_search_and_toc` | DONE |
| 18 | Personal dynamic watermark payload (TZ §4.10, §6) | `GET /reader/{id}/watermark` | — | `WatermarkService` (HMAC) | `test_reader.py::test_watermark_payload_signed` | DONE |
| 19 | Device & session control, limit, admin revoke (TZ §4.11, §7.1) | `GET/DELETE /sessions`, `DELETE /admin/sessions/{id}` | `sessions`, `devices` | `AuthService._enforce_session_limit`, `SessionService` | `test_sessions.py` | DONE |
| 20 | Admin: user management + status + view books/sessions (TZ §7.1) | `/admin/users/*` | `users` | `UserService` | `test_admin.py`, `test_auth.py` | DONE |
| 21 | Admin: book CRUD + file/cover upload + activate (TZ §7.2, §4.13) | `/admin/books/*` | `books` | `BookService` | `test_admin.py` | DONE |
| 22 | Admin: category management (TZ §4.12, §7.2) | `/admin/categories/*` | `categories` | `CategoryService` | `test_admin.py::test_category_crud` | DONE |
| 23 | Admin: grant/revoke access, keep history (TZ §4.14, §7.3) | `/admin/book-access/*` | `book_access` (granted/revoked audit fields) | `AccessService.grant/revoke` | `test_reader.py`, e2e | DONE |
| 24 | Multiple books per user (TZ §7.3) | `POST /admin/book-access` (idempotent) | `book_access` uq(user,book) | `AccessService.grant` | `test_reading.py` | DONE |
| 25 | Admin audit log of key actions (TZ §8, §11) | `GET /admin/audit-logs` | `admin_audit_logs` | `AuditService` | `test_admin.py::test_audit_log_records_admin_actions` | DONE |
| 26 | Private storage, no public indexing (TZ §6, §11) | — | object keys only in DB | `S3Storage` (private bucket) | manual S3 verification (see TESTING.md) | DONE |
| 27 | Secure upload (size/MIME/magic bytes) (TZ §8) | `/admin/books/{id}/file|cover` | — | `utils.uploads`, `utils.files` | `test_admin.py::test_upload_*` | DONE |
| 28 | Standard error format + no stack traces (TZ §8, §11) | global handlers | — | `api.errors` | all tests (envelope asserts) | DONE |
| 29 | Server error logging + correlation id (TZ §8) | `RequestContextMiddleware` | — | `core.logging` | manual | DONE |
| 30 | Reject content API for unauthorized/revoked/inactive (TZ §6, §15) | reader endpoints | `book_access`, `books.status`, `users.status` | `AccessService` | `test_reader.py`, `test_security_idor.py` | DONE |
| 31 | IDOR prevention (annotations, sessions, progress) | ownership-scoped queries | — | `AnnotationRepository.get_owned`, `SessionService.revoke` | `test_security_idor.py` | DONE |
| 32 | Payment: not implemented; access granted manually (TZ §16) | `/admin/book-access` | `book_access` | `AccessService` | e2e | DONE (by design) |
| 33 | Extensible OTP (phone/email) for the future (TZ §5.1) | — | — | `integrations.otp` (provider abstraction) | — | DONE (abstraction) |
| 34 | Health / readiness (non-functional) | `GET /health`, `GET /ready` | — | `api.health` | manual (`ready` verified) | DONE |
| 35 | Rate limiting on sensitive routes | dep `rate_limit` | — | `core.rate_limit` (Redis + fallback) | disabled in tests; manual | DONE |
| 36 | Data integrity (FKs, unique, transactions) (TZ §12, §8) | — | FKs/unique constraints, ON CONFLICT | services commit atomically | migration + `test_admin.py::test_category_crud` (dup) | DONE |

**Out of scope (frontend, TZ §9 & reading-mode UI):** responsive UI, day/night
mode rendering, on-screen watermark rendering, route guards in the browser. The
backend provides all data/authorization these need.
