# Storage & Protected Delivery — Articles365 Backend

## Backends

`StorageService` (`app/integrations/storage/base.py`) is the interface; the
factory `get_storage()` selects the implementation via `STORAGE_BACKEND`:

- **`s3`** — `S3Storage` (aioboto3). Works with **MinIO**, **AWS S3**, and
  **Cloudflare R2** (path-style addressing + SigV4). Configured entirely by env:
  `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`,
  `S3_USE_SSL`.
- **`memory`** — `MemoryStorage`, an in-process backend for tests / offline dev.
  Clearly separated; never used in production.

### Interface

`ensure_bucket`, `upload_file` (large/multipart), `put_bytes` (small, e.g.
covers), `get_bytes`, `download_to_path`, `stat`, `stream_range`, `delete`,
`create_presigned_url`, `ping`.

## Object keys

Server-generated only — the client filename is never used as a path:

```
books/{book_id}/source.{ext}
books/{book_id}/cover.{ext}
```

This prevents path traversal and collisions. Keys live only in the DB
(`books.source_object_key`, `books.cover_object_key`) and are never returned in
API responses.

## Protected content delivery (the important part)

`GET /api/v1/reader/{book_id}/content`:

1. `ReaderService.prepare_content` runs `AccessService.ensure_read_access`
   (authz) and confirms the book is READY with a stored source key.
2. `StorageService.stat` gives the total size.
3. The `Range` header is parsed (`utils/http_range.py`, RFC 7233, single range):
   - **No Range** → `200 OK`, `Content-Length: <size>`, `Accept-Ranges: bytes`,
     body streamed from storage.
   - **Valid Range** → `206 Partial Content`, `Content-Range: bytes a-b/size`,
     `Content-Length: b-a+1`, only that slice streamed.
   - **Unsatisfiable/invalid** → `416`, `Content-Range: bytes */size`.
4. Bytes are streamed chunk-by-chunk (`READER_CHUNK_SIZE`, default 1 MB) via
   `StreamingResponse` — **a large PDF is never fully loaded into memory.**

For S3 this maps to `get_object(..., Range="bytes=a-b")` and iterating the
response body's `iter_chunks`. Verified live against MinIO: `bytes=0-9` → 206 /
10 bytes / `%PDF-`; full GET → 200 / full size / valid PDF; bad range → 416.

## Presigned URLs

`create_presigned_url` exists but is **not** used by default. The chosen
architecture is backend-controlled delivery for full authorization control. If
presigned URLs are ever enabled, they must be short-lived
(`S3_PRESIGN_EXPIRE_SECONDS`), issued only after an access check, and the bucket
must remain private; never store permanent signed links.

## Bucket privacy

The dev `docker-compose` `createbuckets` step runs `mc anonymous set none`. In
production the bucket must have **no public read** policy and no public listing;
access is exclusively via the app's credentials.
