# 11. Testing Strategy

The proposal sets measurable targets in its non-functional requirements (Section 3) and says core features must have software testing (NFR-06). This document turns those targets into a test plan. Tools and AI accuracy targets marked **(proposed)** should be confirmed by the team.

## 11.1 Test levels

| Level | What | Tools (proposed) | When |
|---|---|---|---|
| Unit | Functions and components in isolation (password rules, hashing, extractors, ranking, React components) | `pytest`, `vitest` + React Testing Library | Every PR |
| Integration | API endpoints with a test MySQL database and mocked S3 / AI | `pytest` + Flask test client, `moto` (S3 mock) | Every PR |
| End-to-end | Full user journeys in a browser | Playwright or Cypress | End of each sprint |
| AI quality | Classification, OCR and search accuracy on a labelled sample set | Custom `pytest` scripts | Sprints 3, 4, 6 |
| Performance | Upload, processing and search times; 50 concurrent users | Locust | Sprint 6 |
| Security | Auth, access control, OWASP checks | `pytest` + OWASP ZAP baseline scan | Sprints 5, 6 |
| Usability | Real users completing tasks | Moderated sessions (≥ 5 users) + short survey | Sprint 6 |
| Compatibility | Chrome, Edge, Firefox on Windows and macOS | Manual checklist | Sprint 6 |

## 11.2 Functional test cases

| Ref | Area | Example cases | Requirement |
|---|---|---|---|
| TC-AUTH | Registration and login | Valid registration · each password rule rejected · duplicate email rejected · login success returns JWT · wrong password and unknown email return the same 401 · expired token rejected | FR-01, UC-01, UC-02 |
| TC-UPL | Upload and validation | Each supported type accepted · `.exe` renamed to `.pdf` rejected (content check) · file over limit → 413 · empty file rejected · interrupted upload handled | FR-02, FR-08, UC-03 |
| TC-EXT | Text extraction | Text PDF · scanned PDF → OCR fallback · DOCX with tables · PNG/JPG OCR · TXT in UTF-8 · corrupted file → `FAILED` with reason | FR-09, UC-04 |
| TC-AI | Classification and metadata | Output has all fields · invalid AI JSON retried then falls back to "Uncategorised" · low confidence flagged · existing folders reused · user edits are saved on approve | FR-03, FR-04, FR-05, FR-10 |
| TC-DUP | Duplicate detection | Same file twice → 409 · "upload anyway" works · edited copy flagged as similar · unrelated file not flagged · duplicates are per user | FR-07, UC-07 |
| TC-SRCH | Search | Example queries from the proposal return the expected file in the top 3 · empty query rejected · no results message · never returns another user's files | FR-06, UC-09 |
| TC-SEC | Access control | User A cannot view, download, edit or delete User B's document (404) · all endpoints except register/login require a token · download URL expires | FR-11, UC-10, NFR-02 |

## 11.3 Non-functional verification

| NFR | Target (from proposal) | How it is measured |
|---|---|---|
| NFR-01 Performance | Upload confirmation ≤ 3 s (< 10 MB) | Timed API tests on a 9 MB file |
| | Processing ≤ 30 s (≤ 20 pages) | Pipeline timing logs on a 20-page PDF and a 20-page scanned PDF |
| | Search ≤ 2 s | Locust / API timing with 1,000+ documents in the account |
| | 50 concurrent users | Locust run with 50 users, no errors, targets above still met |
| NFR-02 Security | 100% passwords hashed | DB check: every `password_hash` starts with a BCrypt prefix |
| | HTTPS only; own documents only | TC-SEC suite; ZAP scan with no high-risk findings |
| NFR-03 Usability | Learn basics ≤ 10 min; ≥ 90% task completion | Timed usability sessions with first-time users |
| NFR-04 Reliability | ≥ 99% availability; no data loss; recovery ≤ 60 s | Uptime check during test weeks; kill the worker mid-processing and confirm the file is re-queued within 60 s |
| NFR-05 Scalability | ≥ 10,000 documents per user | Seed 10,000 metadata rows and re-run search timing |
| NFR-06 Maintainability | Tests for core features; documented modules | Coverage report (target ≥ 70% backend, proposed); docs reviewed |
| NFR-07 Compatibility | Chrome, Edge, Firefox; all five file types | Manual browser checklist; TC-EXT on every type |

## 11.4 AI evaluation set (proposed)

Build a small, **non-sensitive** labelled set before Sprint 3:

- ~50 documents across categories (University, Finance, Career, Personal, Medical, Other), all five file types, including some low-quality scans.
- For each: expected category, folder path and 3–5 expected keywords.
- 20 search queries, each with the file(s) that should be found.

| Measure | Target (proposed) |
|---|---|
| Category accuracy | ≥ 80% |
| OCR word accuracy on clean scans | ≥ 90% |
| Search: correct file in top 3 | ≥ 80% of queries |
| Similar-document detection | Edited copies flagged; no false alarms on unrelated files in the set |

Re-run after any change to prompts, models or ranking weights and record the results in the sprint review.

## 11.5 Entry and exit criteria

- **Entry (per sprint test cycle):** features merged into `develop`, test data seeded, environment running.
- **Exit (final release):** all *Must* requirements pass; no open critical or high-severity bugs; NFR targets met or deviations documented with reasons.

## 11.6 Results so far (implementation v0.1)

### Automated backend tests

Run with `cd backend && pytest --cov=app` (in-memory SQLite, no MySQL needed).

| File | Covers | Tests |
|---|---|---|
| `tests/test_auth.py` | TC-AUTH: registration rules, duplicate email, BCrypt storage, login, same error for unknown email / wrong password, lockout, token checks, password change | 20 |
| `tests/test_documents.py` | TC-UPL, TC-EXT, TC-AI, TC-DUP: upload, PDF/DOCX/TXT extraction, wrong type, fake extension, empty/corrupted, size limit, exact + similar duplicates, approve, folder reuse, move/edit, download links, delete, list filters, no-OCR path, reprocess | 19 |
| `tests/test_search_and_security.py` | TC-SRCH, TC-SEC: 7 natural-language queries return the right document first, empty results, per-user isolation on every endpoint, auth required everywhere | 20 |
| `tests/test_ai_and_dashboard.py` | AI evaluation on 9 sample documents, proposal examples, text helpers, dashboard, profile, folders, demo seed | 18 |
| `tests/test_openai_provider.py` | OpenAI output validation, retries and fallback (fake client, no network) | 3 |

**80 passed · backend coverage 86%** (target ≥ 70%).

### Automated frontend tests

Run with `cd frontend && npm run test:run` (Vitest + React Testing Library + jsdom): **85 passed in 9 files** — API client and session handling, protected routes, login and registration forms (validation, password checklist), tag input, and the formatting, file-type, folder and validation helpers.

### Manual end-to-end check in the browser

The React app was run against the real Flask API and MySQL and walked through by hand: login, dashboard, review queue, AI review with similar-file warning, approve, document details with text and PDF preview, natural-language search, upload with progress, duplicate prompt ("Upload anyway / Cancel"), rejected `.exe` file, discard upload, folders, categories, settings, and the mobile layout (375 px). Bugs found and fixed: folder breadcrumb overlapping, PDF viewer showing the link token instead of the filename, and the special-character password rule differing between frontend and backend.

### AI evaluation (local analyser, 9 sample documents in `backend/app/demo.py`)

| Measure | Target | Result |
|---|---|---|
| Category accuracy | ≥ 80% | **9 / 9 (100%)** |
| Search: correct file in top 1 | ≥ 80% of queries | **7 / 7 (100%)** |
| Similar-document detection | Edited copy flagged, unrelated not | Edited copy flagged at 0.975 similarity; unrelated documents not flagged |
| Proposal examples (FR-04, FR-05) | — | `scan001.pdf` → "Network Technologies Assignment Report" with IPv6, Routing, OSPF; `document123.pdf` → `Semester1_Database_Systems_Assignment.pdf` in `University/Year 2/Semester 1/Database Systems` |

The sample set is small and written by the team, so these numbers show the pipeline works end to end; a larger set of real (non-sensitive) documents should be used for the final evaluation.

### End-to-end check on MySQL 8.4 (background processing on)

| NFR-01 target | Measured |
|---|---|
| Upload confirmation ≤ 3 s | 93 ms |
| AI processing ≤ 30 s | ≈ 0.5 s (text document) |
| Search ≤ 2 s | 20–60 ms |
| Dashboard | 22 ms |

Not yet measured: 50 concurrent users (Locust), OCR accuracy (Tesseract not installed on the test machine), usability sessions, cross-browser checklist.

## 11.7 Defect tracking

Bugs are logged as GitHub Issues with: steps to reproduce, expected vs actual result, screenshot, severity (Critical / High / Medium / Low), and the related FR or UC.
