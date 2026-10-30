# 6. REST API Specification (v1.0 — implemented)

The Flask backend in [`backend/`](../backend/README.md) implements every endpoint below. Request and response shapes are checked by the test suite in `backend/tests/`.

## 6.1 Conventions

| | |
|---|---|
| Base URL (dev) | `http://127.0.0.1:5000/api` (the React dev server proxies `/api` to it) |
| Format | JSON, except file upload (`multipart/form-data`) |
| Auth | `Authorization: Bearer <JWT>` on every endpoint except register, login, health and signed file links |
| Token lifetime | 30 minutes (`JWT_ACCESS_TOKEN_EXPIRES_MIN`) |
| Dates | ISO 8601 UTC, e.g. `2026-03-01T10:15:00Z` |
| Pagination | `?page=1&per_page=20` (max 100) → response includes `page`, `per_page`, `total` |

**Error format** (all endpoints)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password must contain an uppercase letter, a special character.",
    "fields": { "password": "Password must contain an uppercase letter, a special character." }
  }
}
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad input, unsupported or corrupted file, content doesn't match extension |
| 401 | `UNAUTHORIZED` | Missing, invalid or expired token; wrong login |
| 401 | `WRONG_PASSWORD` | Current password wrong when changing password |
| 403 | `LINK_EXPIRED` | Signed download link invalid or older than 5 minutes |
| 404 | `NOT_FOUND` | Not found **or belongs to another user** (so IDs can't be probed) |
| 409 | `DUPLICATE_FILE` | Same file (SHA-256) already uploaded by this user |
| 409 | `EMAIL_EXISTS` / `FOLDER_EXISTS` | Email already registered / sibling folder with same name |
| 409 | `STILL_PROCESSING` | Approving or reprocessing while analysis is running |
| 413 | `FILE_TOO_LARGE` / `STORAGE_QUOTA_EXCEEDED` | Over `MAX_UPLOAD_MB` / user's storage quota full |
| 429 | `TOO_MANY_ATTEMPTS` | 5 failed logins for an email within 5 minutes |
| 500 | `SERVER_ERROR` | Anything unexpected |

## 6.2 Endpoint summary

| Method | Path | Purpose | FR / UC |
|---|---|---|---|
| GET | `/health` | Status and client settings (public) | — |
| POST | `/auth/register` | Create account | FR-01 / UC-01 |
| POST | `/auth/login` | Log in, get JWT | FR-01 / UC-02 |
| POST | `/auth/logout` | End session (client discards token) | FR-01 |
| GET | `/auth/me` | Current user | FR-01 |
| POST | `/documents` | Upload a file | FR-02, FR-07, FR-08 / UC-03 |
| GET | `/documents/{id}/analysis` | Processing status + AI suggestions + duplicates | FR-03–FR-07 / UC-04–UC-08 |
| POST | `/documents/{id}/approve` | Accept or edit AI suggestions and store | FR-05 / UC-06, UC-08 |
| POST | `/documents/{id}/reprocess` | Run the AI pipeline again | NFR-04 |
| GET | `/documents` | List / filter / sort documents | UC-10 |
| GET | `/documents/{id}` | Document details + text preview + similar documents | UC-10 |
| PATCH | `/documents/{id}` | Edit metadata, rename, move | UI 8.8 |
| GET | `/documents/{id}/download` | Short-lived download/preview link | UC-10 |
| DELETE | `/documents/{id}` | Delete document and stored file | UI 8.8 |
| GET | `/files/{token}/{filename}` | Serve a file from a signed link (local storage only; the filename is cosmetic) | UC-10 |
| POST | `/search` | Natural-language search | FR-06 / UC-09 |
| GET | `/folders` | Folder tree with document counts | FR-05 |
| POST | `/folders` | Create folder | FR-05 |
| GET | `/categories` | Categories with document counts | FR-03 |
| GET | `/dashboard/stats` | Dashboard numbers, chart data, activity | UI 8.4 |
| GET | `/users/me` | Profile and storage usage | UI 8.9 |
| PATCH | `/users/me` | Update name / email | UI 8.9 |
| PUT | `/users/me/password` | Change password | UI 8.9 |

## 6.3 The document object

Returned by list, details, approve, PATCH and search (search adds `relevance`).

```json
{
  "file_id": 1,
  "name": "Semester1_Database_Systems_Assignment.pdf",
  "original_name": "Database_Assignment.pdf",
  "title": "Assignment 1: Relational Design and SQL",
  "category": "University",
  "subject": "Database Systems",
  "document_type": "Assignment",
  "file_type": "PDF",
  "mime_type": "application/pdf",
  "file_size_bytes": 2560000,
  "folder_id": 4,
  "folder_path": "University/Year 2/Semester 1/Database Systems",
  "status": "STORED",
  "summary": "This assignment applies entity relationship modelling and normalisation…",
  "keywords": ["SQL", "Normalisation", "Loans"],
  "confidence": 0.667,
  "extraction_method": "PYMUPDF",
  "is_user_approved": true,
  "duplicate_of": null,
  "error_message": null,
  "uploaded_at": "2026-10-30T10:15:00Z",
  "updated_at": "2026-10-30T10:15:02Z"
}
```

- `status`: `UPLOADED` → `PROCESSING` → `AWAITING_REVIEW` → `STORED`, or `FAILED`
- `duplicate_of`: `{ "file_id": 1, "name": "…", "type": "EXACT" | "SIMILAR", "score": 0.9754 }` or `null`
- `extraction_method`: `PYMUPDF`, `PYTHON_DOCX`, `TESSERACT_OCR`, `PLAIN_TEXT`

## 6.4 Authentication

### `POST /auth/register`

```json
{ "name": "Alex Chen", "email": "alex@example.com", "password": "Str0ng!Pass" }
```

**201** → `{ "user_id": 1001, "message": "Registration successful. You can now sign in." }` · **400** password rules / bad email · **409** `EMAIL_EXISTS` (case-insensitive)

### `POST /auth/login`

```json
{ "email": "alex@example.com", "password": "Str0ng!Pass" }
```

**200**

```json
{
  "access_token": "eyJhbGciOi...",
  "expires_in": 1800,
  "user": { "user_id": 1001, "name": "Alex Chen", "email": "alex@example.com", "created_at": "2026-10-30T09:00:00Z" }
}
```

**401** "Invalid email or password." for both unknown email and wrong password · **429** after 5 failures

### `GET /auth/me` → **200** user object · `POST /auth/logout` → **204**

## 6.5 Documents

### `POST /documents` — upload

`multipart/form-data`: `file` (required), `allow_duplicate` (`true` / `false`, default `false`)

**202** → `{ "file_id": 10, "status": "PROCESSING" }`

**409** — exact duplicate

```json
{
  "error": {
    "code": "DUPLICATE_FILE",
    "message": "You already have this file: \"Semester1_Database_Systems_Assignment.pdf\".",
    "existing_file": { "file_id": 1, "name": "Semester1_Database_Systems_Assignment.pdf",
                       "folder_path": "University/Year 2/Semester 1/Database Systems", "status": "STORED" }
  }
}
```

### `GET /documents/{id}/analysis` — poll for AI results

The front end polls every ~2 seconds after upload until `status` is `AWAITING_REVIEW`, `STORED` or `FAILED`.

```json
{
  "file_id": 9,
  "status": "AWAITING_REVIEW",
  "original_name": "Database_Assignment_v2.txt",
  "file_type": "TXT",
  "suggestions": {
    "title": "Assignment 1: Relational Design and SQL",
    "summary": "This assignment applies entity relationship modelling and normalisation…",
    "category": "University",
    "subject": "Database Systems",
    "document_type": "Assignment",
    "keywords": ["Books", "Loans", "Member", "SQL", "Queries", "Normalisation"],
    "suggested_filename": "Semester1_Database_Systems_Assignment.txt",
    "suggested_folder_path": ["University", "Year 2", "Semester 1", "Database Systems"],
    "confidence": 0.667
  },
  "similar_documents": [{ "file_id": 1, "name": "Semester1_Database_Systems_Assignment.pdf", "similarity": 0.9754 }],
  "duplicate_of": { "file_id": 1, "name": "Semester1_Database_Systems_Assignment.pdf", "type": "SIMILAR", "score": 0.9754 },
  "error_message": null
}
```

When `status` is `FAILED`, `suggestions` is `null` and `error_message` explains why (e.g. OCR not installed). The user can still approve with manually entered details.

### `POST /documents/{id}/approve`

```json
{
  "title": "Assignment 1: Relational Design and SQL",
  "filename": "Semester1_Database_Systems_Assignment.pdf",
  "folder_path": ["University", "Year 2", "Semester 1", "Database Systems"],
  "category": "University",
  "keywords": ["SQL", "Normalisation"],
  "summary": "…",
  "subject": "Database Systems",
  "document_type": "Assignment"
}
```

`filename` and `folder_path` are required. The real file extension is always enforced. Missing folders are created; existing ones are matched case-insensitively. **200** → document object with `status: "STORED"`.

### `POST /documents/{id}/reprocess` → **202** `{ "file_id": 10, "status": "PROCESSING" }`

### `GET /documents`

| Parameter | Values |
|---|---|
| `status` | `STORED` (default), `AWAITING_REVIEW`, `FAILED`, `PROCESSING`, comma-separated list, or `ALL` |
| `folder_id` | Folder ID |
| `category` | e.g. `Finance` |
| `type` | `PDF`, `DOCX`, `TXT`, `PNG`, `JPG` |
| `sort` / `order` | `uploaded_at` (default) or `name` / `desc` (default) or `asc` |
| `page` / `per_page` | Defaults 1 / 20 |

**200** → `{ "items": [document…], "page": 1, "per_page": 20, "total": 8 }`

### `GET /documents/{id}`

Document object plus `text_preview` (first 3,000 characters of extracted text) and `similar_documents`.

### `PATCH /documents/{id}`

Any of `title`, `filename`, `category`, `subject`, `document_type`, `keywords`, `summary`, `folder_path`. Moving to a new `folder_path` creates the folders. **200** → document object. The search index is updated straight away.

### `GET /documents/{id}/download?inline=true|false`

**200** → `{ "url": "/api/files/eyJrIjoi…/Semester1_Database_Systems_Assignment.pdf", "expires_in": 300, "filename": "Semester1_Database_Systems_Assignment.pdf" }`

- With S3 storage the URL is an S3 pre-signed URL; with local storage it is a signed `/api/files/<token>/<filename>` link.
- `inline=true` is for previews (iframe / image); `false` downloads as an attachment and writes a `DOWNLOAD` audit entry.

### `DELETE /documents/{id}` → **204**

## 6.6 Search

### `POST /search`

```json
{ "query": "Find my Semester 1 Database assignment", "limit": 10 }
```

**200**

```json
{
  "query": "Find my Semester 1 Database assignment",
  "results": [ { "...document object...": "", "relevance": 0.6037 } ],
  "took_ms": 59
}
```

`results` is empty when nothing matches. Only the signed-in user's `STORED` documents are searched.

## 6.7 Folders and categories

### `GET /folders`

```json
[
  { "folder_id": 1, "name": "University", "parent_folder_id": null, "path": "University", "document_count": 0,
    "children": [
      { "folder_id": 2, "name": "Year 2", "parent_folder_id": 1, "path": "University/Year 2", "document_count": 0, "children": [] }
    ] }
]
```

### `POST /folders`

`{ "name": "Semester 1", "parent_folder_id": 2 }` → **201** folder object · **409** `FOLDER_EXISTS`

### `GET /categories` → `[ { "category": "University", "count": 3 }, … ]`

## 6.8 Dashboard and profile

### `GET /dashboard/stats`

```json
{
  "total_documents": 8,
  "ai_classified": 8,
  "duplicates_found": 1,
  "awaiting_review": 1,
  "processing": 0,
  "failed": 0,
  "storage_used_bytes": 41865,
  "storage_quota_bytes": 1073741824,
  "by_category": [ { "category": "University", "count": 3 } ],
  "uploads_by_month": [ { "month": "2026-10", "uploaded": 9, "classified": 9 } ],
  "recent_activity": [ { "action": "APPROVE", "file_id": 8, "file_name": "Residential_Tenancy_Agreement.docx",
                         "details": "Residential_Tenancy_Agreement.docx", "at": "2026-10-30T20:01:12Z" } ]
}
```

`uploads_by_month` always has the last 12 months.

### `GET /users/me`

```json
{ "user_id": 1, "name": "Alex Chen", "email": "demo@fileai.test", "created_at": "2026-10-30T20:01:00Z",
  "document_count": 8, "file_count": 9, "storage_used_bytes": 41865, "storage_quota_bytes": 1073741824 }
```

### `PATCH /users/me` — `{ "name": "…", "email": "…" }` → **200** profile

### `PUT /users/me/password`

`{ "current_password": "Old!Pass1", "new_password": "N3w!Password" }` → **204** · **400** rules not met · **401** `WRONG_PASSWORD`

## 6.9 Health

### `GET /health` (no auth)

```json
{
  "status": "ok",
  "ai_provider": "local", "ai_model": "local-rules-v1",
  "embedding_provider": "local", "embedding_model": "local-hashing-512",
  "ocr_available": false, "storage_backend": "local",
  "max_upload_mb": 20, "low_confidence_threshold": 0.6,
  "allowed_extensions": ["pdf", "docx", "txt", "png", "jpg", "jpeg"]
}
```
