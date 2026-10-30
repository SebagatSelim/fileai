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

## 11.6 Defect tracking

Bugs are logged as GitHub Issues with: steps to reproduce, expected vs actual result, screenshot, severity (Critical / High / Medium / Low), and the related FR or UC.
