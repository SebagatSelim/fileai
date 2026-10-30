# Frontend — React.js + Bootstrap

> **Status:** not started. Implementation begins in NIT3004 (Phase 3). The screens are already designed — see [UI Design](../docs/07-ui-design.md).

The frontend is a single-page web app. It talks to the Flask backend over HTTPS using the REST endpoints in the [API Specification](../docs/06-api-specification.md).

## Planned folder layout

```text
frontend/
├── public/
├── src/
│   ├── api/              # Axios client + one file per API area (auth, documents, search, ...)
│   ├── context/          # AuthContext: holds the logged-in user and JWT
│   ├── routes/           # ProtectedRoute: redirects to /login when not signed in
│   ├── components/       # Shared UI: Sidebar, TopBar, StatCard, DocumentCard, UploadDropzone, ...
│   ├── pages/
│   │   ├── LoginPage.jsx             # UI 8.2
│   │   ├── RegisterPage.jsx          # UI 8.3
│   │   ├── DashboardPage.jsx         # UI 8.4
│   │   ├── UploadPage.jsx            # UI 8.5
│   │   ├── AnalysisPage.jsx          # UI 8.6  (review and approve AI suggestions)
│   │   ├── SearchPage.jsx            # UI 8.7
│   │   ├── DocumentDetailsPage.jsx   # UI 8.8
│   │   └── SettingsPage.jsx          # UI 8.9
│   ├── App.jsx           # Routes
│   └── main.jsx
├── package.json
└── vite.config.js
```

## Planned dependencies

| Purpose | Package |
|---|---|
| Build tool | `vite` |
| UI | `react`, `react-dom`, `bootstrap`, `react-bootstrap` |
| Routing | `react-router-dom` |
| HTTP | `axios` |
| Drag-and-drop upload | `react-dropzone` |
| Dashboard chart | `chart.js` + `react-chartjs-2` |
| Testing | `vitest`, `@testing-library/react` |

## Routes

| Path | Page | Login required |
|---|---|---|
| `/login` | Login | No |
| `/register` | Registration | No |
| `/` | Dashboard | Yes |
| `/upload` | Document upload | Yes |
| `/documents/:id/review` | AI analysis and metadata review | Yes |
| `/search` | Natural language search | Yes |
| `/documents/:id` | Document details | Yes |
| `/settings` | Profile and settings | Yes |

## Local setup (to be confirmed once code exists)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```
