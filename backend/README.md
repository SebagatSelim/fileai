# Backend — Python Flask API

> **Status:** not started. Implementation begins in NIT3004 (Phase 3). This file describes the planned layout so the team can start in the same shape.

The backend handles authentication, file validation, text extraction and OCR, calls to the AI engine, duplicate detection, search, and all reads and writes to MySQL and AWS S3. See [System Architecture](../docs/04-system-architecture.md) and the [API Specification](../docs/06-api-specification.md).

## Planned folder layout

```text
backend/
├── app/
│   ├── __init__.py          # Flask app factory (create_app)
│   ├── config.py            # Reads settings from .env
│   ├── extensions.py        # SQLAlchemy, JWT, Bcrypt, CORS instances
│   ├── models/              # Database models: User, File, DocumentMetadata, Folder, ...
│   ├── api/                 # Blueprints (one per area)
│   │   ├── auth.py          #   /api/auth/*
│   │   ├── documents.py     #   /api/documents/*
│   │   ├── search.py        #   /api/search
│   │   ├── folders.py       #   /api/folders/*
│   │   ├── dashboard.py     #   /api/dashboard/*
│   │   └── users.py         #   /api/users/*
│   ├── services/
│   │   ├── validation.py    # File type, size, integrity checks (FR-08)
│   │   ├── extraction/      # pdf.py (PyMuPDF), docx.py (python-docx), ocr.py (Tesseract), txt.py (FR-09)
│   │   ├── ai/              # classifier.py, metadata.py, embeddings.py (FR-03, FR-04, FR-05, FR-10)
│   │   ├── duplicates.py    # SHA-256 + similarity check (FR-07)
│   │   ├── search.py        # Semantic search and ranking (FR-06)
│   │   ├── storage.py       # AWS S3 upload, delete, pre-signed URLs
│   │   └── pipeline.py      # Runs the full processing pipeline for one upload
│   └── utils/
├── tests/                   # pytest
├── requirements.txt
├── .env.example
└── run.py
```

## Planned dependencies

| Purpose | Package |
|---|---|
| Web framework | `Flask`, `Flask-CORS` |
| Auth | `Flask-JWT-Extended`, `bcrypt` |
| Database | `Flask-SQLAlchemy`, `PyMySQL` (ORM queries are parameterised, which covers NFR-02) |
| Cloud storage | `boto3` |
| PDF text | `PyMuPDF` |
| Word text | `python-docx` |
| OCR | `pytesseract`, `Pillow` (also needs the Tesseract program installed) |
| AI | `openai` and/or `transformers`, `sentence-transformers`, `numpy` |
| Testing | `pytest`, `pytest-cov` |

## Local setup (to be confirmed once code exists)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env               # then fill in the values
flask --app run.py run --debug
```

Install Tesseract OCR separately:

- **Windows:** installer from the UB Mannheim build, then set `TESSERACT_CMD` in `.env`
- **macOS:** `brew install tesseract`
