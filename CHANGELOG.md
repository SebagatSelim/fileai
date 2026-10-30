# Changelog

All notable changes to this project are recorded here. Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — 2026-10-30

First working version of the application.

### Added — backend (Flask)

- Registration and login with FR-01 password rules, BCrypt hashing, JWT (30 min), lockout after 5 failed logins
- Upload of PDF, DOCX, TXT, PNG and JPG with content-type check, size limit, integrity check and storage quota
- Exact duplicate detection (SHA-256, per user) with "upload anyway" option
- Background processing pipeline: PyMuPDF, python-docx, Tesseract OCR (optional) and plain-text extraction; scanned-PDF OCR fallback; automatic recovery of interrupted jobs
- Offline AI analyser: category, document type, title, summary, keywords, filename and folder suggestions (reuses the user's existing folders)
- Optional OpenAI GPT analysis with output validation and automatic fallback; optional OpenAI or Sentence-Transformers embeddings
- Similar-document detection using embeddings
- Natural-language search (semantic + keyword ranking) with a per-user in-memory index
- Review and approve flow, edit / rename / move, folders, categories, dashboard statistics, profile and password change
- Local or AWS S3 file storage with short-lived signed download links
- Audit log for logins, uploads, approvals, views, downloads, edits, deletes and searches
- CLI commands: `init-db`, `seed-demo` (demo account with 9 sample documents), `reindex`
- 80 automated backend tests (86% coverage)

### Added — frontend (React)

- Login, registration with live password checklist, dashboard, upload with drag-and-drop and progress, AI review page, review queue, natural-language search, documents list, document details with preview, folders, categories, profile and settings
- Responsive layout with off-canvas sidebar on phones; automatic sign-out when the session expires
- 85 automated tests (Vitest + React Testing Library)

### Added — tooling

- `setup.bat` (one-time Windows setup) and `start-dev.bat` (starts both servers and opens the browser)

### Changed — documentation

- API specification updated to the implemented v1.0 endpoints
- Architecture: AI providers, search design and technical decisions recorded
- Database design: duplicate columns on `document_metadata`, keyword order, `FULLTEXT` index removed
- Testing strategy: test results, AI evaluation and measured response times

## [0.0.1] — 2026-10-30

### Added

- Repository structure (`docs/`, `frontend/`, `backend/`, `database/`)
- Project documentation set based on the NIT3003 proposal and presentation
- MySQL schema `database/schema.sql`
- `.gitignore`, `.gitattributes`, pull request template, contributing guide

## Milestones

- **M2 — Oral presentation** (NIT3003): completed
- **M1 — Project proposal** (NIT3003): completed
