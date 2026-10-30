# Frontend — FileAI (React + Vite + Bootstrap)

**FileAI — "Organize smarter with AI"** is the web client for the AI-Powered Personal Digital File Organizer (NIT3003/NIT3004, Group 4). It is a single-page app that talks to the Flask backend in [`../backend`](../backend) through the REST API under `/api`.

The screens follow the prototypes in [UI Design](../docs/07-ui-design.md): a dark navy sidebar with teal accents, white rounded cards and a teal/cyan hero banner on the dashboard.

## Requirements

- **Node.js** 20.19+ or 22.12+ (developed on Node 24.22, npm 11.19)
- The **backend** running on `http://127.0.0.1:5000` (see [`../backend/README.md`](../backend/README.md)). The frontend still starts without it, but every API call will show a "Can't reach the FileAI server" message.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**, create an account on the Register page, then sign in.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port **5173** with hot reload. `/api/*` is proxied to the Flask backend. |
| `npm run build` | Production build into `dist/`. |
| `npm run preview` | Serves the `dist/` build on port 4173 (same `/api` proxy). |
| `npm test` | Vitest in watch mode. |
| `npm test -- --run` (or `npm run test:run`) | Runs the unit tests once (CI style). |

## API base URL and proxy

All requests use the **relative** base URL `/api` (see `src/api/client.js`), so the browser always talks to the same origin and no CORS setup is needed in development.

- In development, Vite proxies `/api` to `http://127.0.0.1:5000` (`vite.config.js`).
- To point at a backend somewhere else, set `VITE_API_PROXY_TARGET` when starting the dev server:

  ```bash
  # macOS / Linux / Git Bash
  VITE_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev
  # PowerShell
  $env:VITE_API_PROXY_TARGET="http://127.0.0.1:8000"; npm run dev
  ```

- In production, serve `dist/` and the API from the same origin (for example Nginx serving `dist/` and forwarding `/api` to Flask, or Flask serving the built files). Configure the web server to return `index.html` for unknown paths so client-side routes such as `/documents/42` work on refresh.

No `.env` file is required for the frontend.

## Routes

| Path | Page | Login |
|---|---|---|
| `/login` | Sign in (email, masked password with show/hide, validation, API error messages) | No |
| `/register` | Create account (first + last name → `name`, live FR-01 password checklist, confirm password) | No |
| `/` | Dashboard: greeting banner, 4 stat cards, uploads-vs-classified chart, AI activity feed, documents by category, quick actions, empty state for new users | Yes |
| `/upload` | Drag-and-drop or browse; type/size checks; sequential uploads with progress bars; "Analysing…" polling; duplicate handling ("Upload anyway" / "Cancel") | Yes |
| `/documents/:id/review` | AI Analysis & Metadata: confidence ring + low-confidence warning, editable title / filename / category / subject / type / folder path / keywords / summary, similar-document warning, Approve & Save, Discard, Retry processing | Yes |
| `/review` | Review queue: documents awaiting review, failed processing, and still analysing | Yes |
| `/search` | Natural-language search with example chips, ranked result cards with relevance bars, `took_ms`; reads `?q=` | Yes |
| `/documents` | Document table / grid with category, type, folder, status and sort filters (kept in the URL) and pagination | Yes |
| `/documents/:id` | Document details: preview (PDF iframe, image, or extracted text), full metadata, Edit, Rename, Move, Download, Delete | Yes |
| `/folders` | Folder tree with expand/collapse and counts, documents in the selected folder (`?folder=<id>`), New folder | Yes |
| `/categories` | One card per category with counts; click → `/documents?category=…` | Yes |
| `/settings` | Profile (name, email), change password, storage usage, "About AI processing" + privacy note (`?tab=security|storage|ai`) | Yes |
| `*` | 404 page | No |

Signed-in pages share one layout: sidebar (off-canvas below 992 px), top bar with quick search (submits to `/search?q=…`, press <kbd>/</kbd> to focus), Upload button and account menu.

## Project structure

```text
frontend/
├── index.html                 # HTML shell (title, favicon)
├── vite.config.js             # Dev server (port 5173), /api proxy, Vitest config
├── public/favicon.svg
└── src/
    ├── main.jsx               # Providers: Router → Toasts → App config → Auth
    ├── App.jsx                # Route table (signed-in pages are lazy-loaded)
    ├── api/                   # Axios client + one module per API area
    │   ├── client.js          #   base URL /api, Bearer token, 401 handling, getApiError()
    │   ├── auth.js  documents.js  search.js  folders.js
    │   └── categories.js  dashboard.js  users.js  health.js
    ├── context/
    │   ├── AuthContext.jsx    # user, login(), logout(), register(), updateUser()
    │   ├── ToastContext.jsx   # toast.success / error / warning / info
    │   ├── AppConfigContext.jsx  # GET /api/health (upload limit, allowed types, thresholds)
    │   └── WorkspaceContext.jsx  # GET /api/dashboard/stats for sidebar badge, storage, dashboard
    ├── routes/                # ProtectedRoute, PublicOnlyRoute
    ├── hooks/                 # useAnalysisPolling, useLookups, useSignOut, useClickOutside, useDocumentTitle
    ├── components/
    │   ├── layout/            # AppLayout, Sidebar, TopBar, UserMenu, page titles
    │   ├── charts/            # UploadsChart (line), CategoryDoughnut, Chart.js registration
    │   ├── MetadataFields.jsx # Shared metadata form (review + edit)
    │   ├── FolderPathInput.jsx, TagInput.jsx, PasswordInput.jsx, PasswordChecklist.jsx
    │   ├── Modal.jsx, ConfirmModal.jsx, Feedback.jsx (loading / empty / error / skeleton)
    │   └── Badges.jsx, ConfidenceRing.jsx, StatCard.jsx, StorageWidget.jsx, Pagination.jsx, ...
    ├── pages/                 # One component per route (+ *.test.jsx)
    ├── utils/                 # format (bytes, dates, relative time), fileTypes, validation, folders, labels, download
    ├── styles/app.css         # FileAI theme on top of Bootstrap 5
    └── test/                  # Vitest setup + renderWithProviders helper
```

## How key features work

**Authentication.** `POST /api/auth/login` returns `access_token`; it is stored in `sessionStorage` under `fileai_token`, together with the user (`fileai_user`) and an expiry time (`fileai_token_expires_at`, from `expires_in`). The Axios interceptor adds `Authorization: Bearer <token>` to every request. Any **401 from a protected call** clears the session and sends the user to `/login` with a "session expired" message; after signing in again they return to the page they were on. The session also ends automatically when `expires_in` runs out. Login, register, logout and change-password calls opt out of the redirect (`skipAuthRedirect`), because their 401s mean "wrong password", not "session ended".

**Upload → review.** Files are checked in the browser (extension and size, using `allowed_extensions` and `max_upload_mb` from `GET /api/health`, default 20 MB), then uploaded **one at a time** with `allow_duplicate=false`. After `202` the queue polls `GET /api/documents/{id}/analysis` every 2 s until the status is `AWAITING_REVIEW`, `STORED` or `FAILED`, then shows a **Review** button. A `409 DUPLICATE_FILE` shows the existing file and folder with **Upload anyway** (resends with `allow_duplicate=true`) or **Cancel**; `400`/`413` errors are shown on the file's row.

**Review page.** If the document is still processing it polls and shows the analysis steps. The form is filled from `suggestions`; suggestions below `low_confidence_threshold` (from `/api/health`, default 0.6) get an amber warning. If processing failed, the error is shown with **Retry processing** (`POST /reprocess`) and the form can still be filled in by hand and approved. Approve sends the folder as an array of segments; missing folders are created by the backend.

**Previews and downloads.** `GET /api/documents/{id}/download?inline=true` returns a short-lived URL that is used directly as the `<iframe>` (PDF) or `<img>` (PNG/JPG) source; DOCX and TXT show `text_preview`. Download uses `inline=false` and navigates to the returned URL.

## Testing

```bash
npm test -- --run
```

85 tests in 9 files (Vitest + Testing Library + jsdom):

| File | Covers |
|---|---|
| `utils/validation.test.js` | FR-01 password rules, email format, login / registration / change-password and metadata validators |
| `utils/format.test.js` | `formatBytes`, relative time ("12 min ago"), percentages, months, names, greetings |
| `utils/fileTypes.test.js` | `fileTypeIcon`, extension handling, upload type/size validation (FR-02) |
| `utils/folders.test.js` | Folder tree flattening, lookup and autocomplete helpers |
| `api/client.test.js` | Bearer header, 401 → session cleared, opt-out for wrong current password, error normalisation |
| `components/TagInput.test.jsx` | Adding / removing keyword chips |
| `pages/LoginPage.test.jsx` | Required fields, email format, show/hide password, successful login stores the token, API error shown |
| `pages/RegisterPage.test.jsx` | Live password checklist, confirm mismatch, `name = "first last"`, `EMAIL_EXISTS` |
| `routes/ProtectedRoute.test.jsx` | Redirect when signed out, 401 → login with "session expired" |

## Tech stack

| Purpose | Package (installed version) |
|---|---|
| Build tool | `vite` 8.3, `@vitejs/plugin-react` 6.1 |
| UI | `react` / `react-dom` 19.3, `bootstrap` 5.3, `bootstrap-icons` 1.13, `@fontsource/inter` 5.3 |
| Routing | `react-router-dom` 7.18 |
| HTTP | `axios` 1.21 |
| Drag-and-drop upload | `react-dropzone` 20.1 |
| Dashboard charts | `chart.js` 4.6 + `react-chartjs-2` 5.3 |
| Testing | `vitest` 5.0, `@testing-library/react` 16.3, `@testing-library/jest-dom` 7.0, `@testing-library/user-event` 14.6, `jsdom` 30.1 |

Bootstrap's JavaScript is not used: modals, dropdowns, toasts and the off-canvas sidebar are small React components using Bootstrap's CSS classes.
