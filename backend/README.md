# Backend — Python Flask API

REST API for the AI-Powered Personal Digital File Organizer: authentication, upload validation, text extraction and OCR, AI classification and metadata, duplicate detection, natural-language search, and file storage.

See also: [System Architecture](../docs/04-system-architecture.md) · [API Specification](../docs/06-api-specification.md) · [Database Design](../docs/05-database-design.md)

## Requirements

- Python 3.11+ (tested on 3.13)
- MySQL 8 (Laragon, XAMPP or a standalone install)
- *Optional:* [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) to read scanned PDFs and images
- *Optional:* an OpenAI API key for GPT-based analysis (the built-in local analyser works without one)

## Setup

```bash
cd backend
python -m venv .venv
# Windows (Git Bash):  source .venv/Scripts/activate
# Windows (PowerShell): .venv\Scripts\Activate.ps1
# macOS:               source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit DATABASE_URL if your MySQL user/password differ
```

Start MySQL (e.g. **Start All** in Laragon), then:

```bash
flask --app run.py init-db       # creates the file_organizer database and tables
flask --app run.py seed-demo     # optional: demo account with 9 sample documents
flask --app run.py run --port 5000
```

The API is now on <http://127.0.0.1:5000/api> — check <http://127.0.0.1:5000/api/health>.

Demo login (after `seed-demo`): **demo@fileai.test** / **Demo@12345**

> You can also create the tables with the SQL script instead of `init-db`: `mysql -u root < ../database/schema.sql`

## Configuration

All settings come from `.env` (see [`.env.example`](.env.example) for every option).

| Setting | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `mysql+pymysql://root:@127.0.0.1:3306/file_organizer` | Any SQLAlchemy URL |
| `STORAGE_BACKEND` | `local` | `local` saves to `backend/uploads/`; `s3` uses `S3_BUCKET_NAME` and AWS credentials |
| `AI_PROVIDER` | `local` | `openai` uses GPT (needs `OPENAI_API_KEY`), with automatic fallback to local |
| `EMBEDDING_PROVIDER` | `local` | `openai` or `sentence-transformers` for true semantic search; run `flask --app run.py reindex` after changing |
| `TESSERACT_CMD` | *(empty)* | Path to `tesseract.exe` if it is not on PATH |
| `MAX_UPLOAD_MB` | `20` | Per-file limit |
| `SIMILARITY_THRESHOLD` | `0.90` | Similar-document warning threshold |

## Commands

| Command | What it does |
|---|---|
| `flask --app run.py init-db` | Create database and tables (`--drop` to start over) |
| `flask --app run.py seed-demo` | Demo account + sample documents run through the real pipeline |
| `flask --app run.py reindex` | Recompute all embeddings (after changing the embedding provider) |
| `pytest` | Run the test suite (uses in-memory SQLite, no MySQL needed) |
| `pytest --cov=app` | Tests with a coverage report |

## Code layout

```text
backend/
├── app/
│   ├── __init__.py          # create_app(): extensions, blueprints, error handlers
│   ├── config.py            # settings from environment variables
│   ├── models.py            # SQLAlchemy models (mirror database/schema.sql)
│   ├── serializers.py       # JSON shapes returned by the API
│   ├── errors.py            # {"error": {"code", "message"}} responses
│   ├── cli.py               # init-db, seed-demo, reindex
│   ├── demo.py              # fictional sample documents
│   ├── api/                 # auth, documents, search, folders, dashboard, users, health, files
│   └── services/
│       ├── validation.py    # extension + magic-byte check, size, integrity, SHA-256   (FR-08)
│       ├── extraction.py    # PyMuPDF, python-docx, Tesseract, plain text             (FR-09)
│       ├── ai/local.py      # offline classifier, metadata, filename + folder rules    (FR-03–FR-05)
│       ├── ai/openai_provider.py  # GPT analysis with validation + fallback           (FR-10)
│       ├── ai/embeddings.py # hashing / sentence-transformers / OpenAI embeddings
│       ├── pipeline.py      # background processing + crash recovery                  (NFR-04)
│       ├── search.py        # hybrid semantic + keyword ranking, similar documents     (FR-06, FR-07)
│       ├── index.py         # per-user in-memory vector index                          (NFR-05)
│       ├── folders.py       # folder tree helpers
│       ├── storage.py       # local folder or AWS S3, signed download links
│       └── audit.py         # audit log
├── tests/                   # pytest suite
├── requirements.txt
├── .env.example
└── run.py
```

## How a document is processed

1. `POST /api/documents` validates the file (type by content, size, opens correctly), hashes it and rejects exact duplicates with **409** unless `allow_duplicate=true`.
2. The file is saved (local folder or S3) and the API returns **202** straight away.
3. A background thread extracts the text (OCR for images and scanned PDF pages), asks the analyser for category, title, summary, keywords, filename and folder, builds an embedding, and flags similar documents.
4. The document waits in `AWAITING_REVIEW` until the user approves or edits the suggestions (`POST /api/documents/{id}/approve`).
5. If the server stops mid-way, unfinished documents are picked up again automatically.

## Notes

- **OCR:** without Tesseract, text PDFs, DOCX and TXT work fully; images and scanned PDFs are marked `FAILED` with a clear message, and the user can still enter details manually and store the file.
- **OpenAI on locked-down Windows PCs:** some Windows security policies (Smart App Control) block the `pydantic_core` library that the OpenAI SDK needs. The app then logs a warning and uses the local analyser.
- **Security:** BCrypt password hashing, JWT (30 min), per-user access checks on every query (other users' files return 404), login lockout after 5 failed attempts, signed short-lived download links, parameterised queries via SQLAlchemy.
