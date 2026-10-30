# 6. REST API Specification (draft v0.1)

> **Draft.** The proposal describes the features but not the API. These endpoints were derived from the functional requirements, use cases and sequence diagrams so front-end and back-end work can start in parallel. Change them as needed and keep this file up to date.

## 6.1 Conventions

| | |
|---|---|
| Base URL (dev) | `http://localhost:5000/api` |
| Format | JSON (`Content-Type: application/json`), except file upload (`multipart/form-data`) |
| Auth | `Authorization: Bearer <JWT>` on every endpoint except register and login |
| IDs | Integers |
| Dates | ISO 8601 UTC, e.g. `2026-03-01T10:15:00Z` |
| Pagination | `?page=1&per_page=20` → response includes `page`, `per_page`, `total` |

**Error format** (all endpoints)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password must contain at least one uppercase letter.",
    "fields": { "password": "Missing uppercase letter" }
  }
}
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad input, unsupported file type |
| 401 | `UNAUTHORIZED` | Missing, invalid or expired token; wrong login |
| 404 | `NOT_FOUND` | Not found **or belongs to another user** |
| 409 | `DUPLICATE_FILE` / `EMAIL_EXISTS` | Exact duplicate upload; email already registered |
| 413 | `FILE_TOO_LARGE` | Over `MAX_UPLOAD_MB` |
| 422 | `PROCESSING_FAILED` | Text extraction or AI step failed |
| 500 | `SERVER_ERROR` | Anything unexpected |

## 6.2 Endpoint summary

| Method | Path | Purpose | FR / UC |
|---|---|---|---|
| POST | `/auth/register` | Create account | FR-01 / UC-01 |
| POST | `/auth/login` | Log in, get JWT | FR-01 / UC-02 |
| POST | `/auth/logout` | End session | FR-01 |
| GET | `/auth/me` | Current user | FR-01 |
| POST | `/documents` | Upload a file | FR-02, FR-07, FR-08 / UC-03 |
| GET | `/documents/{id}/analysis` | Processing status + AI suggestions + duplicates | FR-03–FR-07 / UC-04–UC-08 |
| POST | `/documents/{id}/approve` | Accept or edit AI suggestions and store | FR-05 / UC-06, UC-08 |
| GET | `/documents` | List / browse documents | UC-10 |
| GET | `/documents/{id}` | Document details | UC-10 |
| PATCH | `/documents/{id}` | Edit metadata, rename, move | UI 8.8 |
| GET | `/documents/{id}/download` | Get a pre-signed download URL | UC-10 |
| DELETE | `/documents/{id}` | Delete document | UI 8.8 |
| POST | `/search` | Natural language search | FR-06 / UC-09 |
| GET | `/folders` | Folder tree | FR-05 |
| POST | `/folders` | Create folder | FR-05 |
| GET | `/dashboard/stats` | Dashboard numbers | UI 8.4 |
| GET | `/users/me` | Profile and storage usage | UI 8.9 |
| PATCH | `/users/me` | Update profile | UI 8.9 |
| PUT | `/users/me/password` | Change password | UI 8.9 |

## 6.3 Authentication

### `POST /auth/register`

```json
{ "name": "Al Shahariar", "email": "user@example.com", "password": "Str0ng!Pass" }
```

- **201 Created** → `{ "user_id": 1001, "message": "Registration successful" }`
- **400** password rules or bad email · **409** `EMAIL_EXISTS`

### `POST /auth/login`

```json
{ "email": "user@example.com", "password": "Str0ng!Pass" }
```

**200 OK**

```json
{
  "access_token": "eyJhbGciOi...",
  "expires_in": 1800,
  "user": { "user_id": 1001, "name": "Al Shahariar", "email": "user@example.com" }
}
```

**401** with the same message for unknown email and wrong password.

### `POST /auth/logout` → **204**
### `GET /auth/me` → **200** user object

## 6.4 Documents

### `POST /documents` — upload

`multipart/form-data`

| Field | Required | Notes |
|---|---|---|
| `file` | Yes | PDF, DOCX, TXT, PNG, JPG |
| `allow_duplicate` | No | `true` to upload even if an exact duplicate exists |

**202 Accepted** — processing has started

```json
{ "file_id": 501, "status": "PROCESSING" }
```

**409 Conflict** — exact duplicate (same SHA-256)

```json
{
  "error": {
    "code": "DUPLICATE_FILE",
    "message": "You already have this file.",
    "existing_file": { "file_id": 233, "name": "Database_Assignment.pdf", "folder_path": "University/Year 2/Semester 1/Database Systems" }
  }
}
```

### `GET /documents/{id}/analysis` — poll for AI results

The front end calls this every ~2 seconds after upload until `status` is `AWAITING_REVIEW` or `FAILED`.

```json
{
  "file_id": 501,
  "status": "AWAITING_REVIEW",
  "original_name": "scan001.pdf",
  "suggestions": {
    "title": "Network Technologies Assignment Report",
    "summary": "A university report on the implementation of IPv6 addressing and routing protocols.",
    "category": "University",
    "subject": "Network Technologies",
    "document_type": "Assignment",
    "keywords": ["IPv6", "Routing", "OSPF", "Network Configuration"],
    "suggested_filename": "Network_Technologies_Assignment_Report.pdf",
    "suggested_folder_path": ["University", "Year 2", "Semester 1", "Network Technologies"],
    "confidence": 0.91
  },
  "similar_documents": [
    { "file_id": 233, "name": "Network_Report_Draft.pdf", "similarity": 0.94 }
  ],
  "error_message": null
}
```

### `POST /documents/{id}/approve` — store with final values

Send the AI values unchanged, or the user's edits.

```json
{
  "title": "Network Technologies Assignment Report",
  "filename": "Network_Technologies_Assignment_Report.pdf",
  "folder_path": ["University", "Year 2", "Semester 1", "Network Technologies"],
  "category": "University",
  "keywords": ["IPv6", "Routing", "OSPF"],
  "summary": "A university report on IPv6 addressing and routing."
}
```

**200 OK** → full document object, `status: "STORED"`. Missing folders in `folder_path` are created.

To discard the upload instead (e.g. after a similar-document warning), call `DELETE /documents/{id}`.

### `GET /documents`

Query parameters: `folder_id`, `category`, `type`, `status` (default `STORED`), `sort` (`uploaded_at` | `name`), `order` (`asc` | `desc`), `page`, `per_page`.

```json
{
  "items": [
    {
      "file_id": 501,
      "name": "Network_Technologies_Assignment_Report.pdf",
      "title": "Network Technologies Assignment Report",
      "category": "University",
      "file_type": "PDF",
      "file_size_bytes": 2560000,
      "folder_path": "University/Year 2/Semester 1/Network Technologies",
      "uploaded_at": "2026-03-01T10:15:00Z"
    }
  ],
  "page": 1, "per_page": 20, "total": 1
}
```

### `GET /documents/{id}`

List item fields plus `summary`, `keywords`, `subject`, `document_type`, `original_name`, `confidence`, `is_duplicate_of` (if any).

### `PATCH /documents/{id}`

Any of: `title`, `filename`, `folder_id` or `folder_path`, `category`, `keywords`, `summary`. → **200** updated document.

### `GET /documents/{id}/download`

**200 OK**

```json
{ "url": "https://<bucket>.s3.amazonaws.com/...&X-Amz-Expires=300", "expires_in": 300 }
```

Writes a `DOWNLOAD` row to `audit_logs`.

### `DELETE /documents/{id}` → **204**

Removes the S3 object and all database rows for the file.

## 6.5 Search

### `POST /search`

```json
{ "query": "Find my Semester 1 Database assignment", "limit": 10 }
```

**200 OK**

```json
{
  "query": "Find my Semester 1 Database assignment",
  "results": [
    {
      "file_id": 233,
      "name": "Database_Assignment.pdf",
      "title": "Database Systems Assignment 1",
      "category": "University",
      "summary": "ER modelling and normalisation exercises…",
      "folder_path": "University/Year 2/Semester 1/Database Systems",
      "uploaded_at": "2026-02-20T08:00:00Z",
      "relevance": 0.92
    }
  ],
  "took_ms": 184
}
```

Empty `results` when nothing matches (UI shows "No matching documents found").

## 6.6 Folders

### `GET /folders`

```json
[
  { "folder_id": 1, "name": "University", "children": [
      { "folder_id": 2, "name": "Year 2", "children": [] }
  ]}
]
```

### `POST /folders`

```json
{ "name": "Semester 1", "parent_folder_id": 2 }
```

→ **201** folder object · **409** if a sibling already has that name.

## 6.7 Dashboard and profile

### `GET /dashboard/stats`

```json
{
  "total_documents": 1284,
  "ai_classified": 1247,
  "duplicates_found": 23,
  "storage_used_bytes": 10200547328,
  "storage_quota_bytes": 16106127360,
  "uploads_by_month": [ { "month": "2026-01", "uploaded": 40, "classified": 38 } ],
  "recent_activity": [ { "action": "UPLOAD", "file_name": "Invoice_2026.pdf", "at": "2026-03-01T10:15:00Z" } ]
}
```

### `GET /users/me` · `PATCH /users/me`

```json
{ "user_id": 1001, "name": "Al Shahariar", "email": "user@example.com", "storage_used_bytes": 10200547328, "document_count": 1284 }
```

### `PUT /users/me/password`

```json
{ "current_password": "Old!Pass1", "new_password": "N3w!Password" }
```

→ **204** · **400** rules not met · **401** current password wrong
