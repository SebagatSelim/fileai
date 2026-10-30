# 2. Requirements Specification

Source: Project Proposal, Sections 2 and 3. Each requirement has an ID so code, tests and pull requests can refer to it (e.g. a PR titled `feat(upload): drag-and-drop upload [FR-02]`).

**Priority key:** **Must** = needed for the final demo · **Should** = important, planned · **Could** = only if time allows

---

## 2.1 Functional requirements — front end

### FR-01 User registration and authentication — *Must*

- The user registers with **full name, email and password**.
- Email must be a valid format and **not already registered**.
- Password must have:
  - at least **8 characters**
  - at least one **uppercase** letter
  - at least one **lowercase** letter
  - at least one **number**
  - at least one **special character**
- Registration is rejected with a clear message if any rule fails.
- The front end checks required fields before sending; the server re-validates, hashes the password with **BCrypt** and issues a **JWT** on login.

### FR-02 File upload management — *Must*

- Supported formats: **PDF, DOCX, TXT, PNG, JPG**.
- Upload interface provides: drag-and-drop, file picker button, progress bar, format validation messages, upload confirmation.
- Workflow: user selects file → front end checks type and size → file sent securely to the backend → processing starts → AI results shown to the user.

### FR-03 AI-based document classification — *Must*

After upload the system analyses the content and determines:

- document type,
- subject / topic,
- category,
- recommended storage location.

| Uploaded file | AI classification |
|---|---|
| `Database_Assignment.pdf` | University → Year 2 → Database Systems |
| `Invoice_2026.pdf` | Finance → Invoice |
| `Resume.docx` | Career → Resume |

### FR-04 Metadata generation — *Must*

The system generates: **title, keywords, summary, category, suggested folder**.

> Example — `scan001.pdf`
> **Title:** Network Technologies Assignment Report
> **Keywords:** IPv6, Routing, OSPF, Network Configuration
> **Summary:** A university report on the implementation of IPv6 addressing and routing protocols.

### FR-05 Intelligent folder and filename recommendation — *Must*

- Suggest a filename and folder path from the document content.
- Example: `document123.pdf` → `Semester1_Database_Systems_Assignment.pdf` in `University / Year 2 / Semester 1 / Database Systems`.
- **The user can approve or change the suggestions before the file is stored.**

### FR-06 Natural-language search — *Must*

- Accept queries such as *"Find my database assignment from semester one"* or *"Find documents about network security"*.
- Process: convert the query to a semantic representation → compare with stored document content and metadata → retrieve the most relevant files → show them ranked by similarity.

### FR-07 Duplicate file detection — *Must (exact) / Should (similar)*

- **Exact duplicates:** SHA-256 hash of each upload; matching hash = duplicate.
- **Similar documents:** vector similarity to detect edited copies, different versions and similar documents.
- The user is warned and decides whether to continue storing the file.

## 2.2 Functional requirements — server

### FR-08 File validation and processing — *Must*

Before analysis the server:

- checks the file format is supported (by content, not only extension),
- checks the file size limit,
- generates a unique file identifier,
- verifies file integrity (file opens and is not corrupted).

### FR-09 Document text extraction — *Must*

| File type | Technology |
|---|---|
| PDF | PyMuPDF |
| DOCX | python-docx |
| PNG / JPG | Tesseract OCR |
| TXT | Read directly |

Scanned PDFs with no selectable text should fall back to OCR (see [Architecture §4.4](04-system-architecture.md#44-document-processing-pipeline)).

### FR-10 AI processing pipeline — *Must*

The backend sends the extracted text to the AI service (OpenAI GPT or Hugging Face models) to produce: classification, keywords, summary, filename suggestion, folder recommendation. Results are **validated** and stored with the file's metadata.

### FR-11 Secure data processing — *Must*

- HTTPS for all communication
- JWT authentication
- BCrypt password hashing
- Per-user file access permissions
- Parameterised database queries
- Identity is verified on the server **before** any stored document is returned.

## 2.3 Non-functional requirements

### NFR-01 Performance

| Requirement | Target |
|---|---|
| Upload confirmation | ≤ **3 s** for files < 10 MB |
| AI analysis (OCR + classification + keywords + summary) | ≤ **30 s** for documents ≤ 20 pages |
| Search response | ≤ **2 s** |
| Concurrent users | **50** users during testing without degradation |

Achieved through database indexing, asynchronous AI requests, and optimised file storage.

### NFR-02 Security

| Requirement | Target |
|---|---|
| Password security | 100% of stored passwords are BCrypt hashes |
| Authentication | Only authenticated users reach protected endpoints |
| Data privacy | Users can only access their own documents |
| Secure communication | All traffic over HTTPS |
| Database | Parameterised queries only |
| Sessions | Time out after a set period of inactivity |

### NFR-03 Usability

| Requirement | Target |
|---|---|
| Learning time | New users understand basic functions within **10 minutes** |
| Task completion | ≥ **90%** of users complete upload and organisation successfully |
| Accessibility | Works on all major desktop browsers; readable fonts, good contrast, clear error messages |

Also: easy navigation, drag-and-drop upload, clear display of AI suggestions, editable filename and folder, friendly error messages.

### NFR-04 Reliability

| Requirement | Target |
|---|---|
| Availability | ≥ **99%** during testing |
| Data integrity | No document lost during normal operation; files unchanged by processing |
| Error recovery | Failed processing tasks recovered within **60 s** |
| Backups | Document metadata is backed up |

### NFR-05 Scalability

| Requirement | Target |
|---|---|
| Document capacity | At least **10,000 documents per user** |
| Database growth | New records without structural changes |
| User growth | Architecture allows adding servers |
| Extensibility | New AI models can be added without redesign |

### NFR-06 Maintainability

- Modular backend; AI, backend and database components developed independently
- Documented source code and normalised database
- Version control with Git
- Automated tests for core features

### NFR-07 Compatibility

| Requirement | Target |
|---|---|
| Browsers | Chrome, Edge, Firefox |
| Operating systems | Windows and macOS via browser |
| Devices | Desktop and laptop; responsive layout |
| File types | PDF, DOCX, TXT, PNG, JPG all processed correctly |

---

## 2.4 Traceability matrix

How each requirement links to use cases, design, code and tests. Keep this table updated as features change.

| Requirement | Use case(s) | UI screen | API endpoint(s) | Backend code | Tests | Status |
|---|---|---|---|---|---|---|
| FR-01 | UC-01, UC-02 | Login, Registration | `/api/auth/*` | `api/auth.py` | `test_auth.py` | ✅ |
| FR-02 | UC-03 | Upload | `POST /api/documents` | `api/documents.py` | `test_documents.py` | ✅ |
| FR-03 | UC-05 | AI Analysis | `GET /api/documents/{id}/analysis` | `services/ai/` | `test_ai_and_dashboard.py` | ✅ |
| FR-04 | UC-06 | AI Analysis | `GET /api/documents/{id}/analysis` | `services/ai/`, `services/text.py` | `test_ai_and_dashboard.py` | ✅ |
| FR-05 | UC-08 | AI Analysis | `POST /api/documents/{id}/approve` | `services/ai/local.py`, `services/folders.py` | `test_documents.py` | ✅ |
| FR-06 | UC-09 | Search | `POST /api/search` | `services/search.py`, `services/index.py` | `test_search_and_security.py` | ✅ |
| FR-07 | UC-07 | AI Analysis | `POST /api/documents`, `GET …/analysis` | `services/pipeline.py`, `services/search.py` | `test_documents.py` | ✅ |
| FR-08 | UC-03, UC-04 | Upload | `POST /api/documents` | `services/validation.py` | `test_documents.py` | ✅ |
| FR-09 | UC-04 | — | (pipeline) | `services/extraction.py` | `test_documents.py` | ✅ PDF/DOCX/TXT · OCR needs Tesseract installed |
| FR-10 | UC-05, UC-06, UC-08 | AI Analysis | (pipeline) | `services/pipeline.py`, `services/ai/` | `test_openai_provider.py` | ✅ |
| FR-11 | UC-02, UC-10 | Document Details | all protected endpoints | `api/helpers.py`, `services/storage.py` | `test_search_and_security.py` | ✅ (HTTPS is set up at deployment) |

Test references (TC-AUTH, TC-UPL, …) are defined in [Testing Strategy](11-testing-strategy.md).
