# 7. UI Design

Source: Project Proposal, Section 8. Prototypes were designed in Figma and will be built with React.js and Bootstrap. The prototype's working name is **FileAI — "Organize smarter with AI"**.

## 7.1 Design principles

- **Consistent layout:** left sidebar navigation, top bar with quick search, upload button and profile menu on every signed-in page.
- **Responsive:** works on desktop and laptop screens (NFR-07).
- **Accessible:** readable fonts, strong colour contrast, clear error messages (Nielsen, 1994; NFR-03).
- **User stays in control:** every AI suggestion can be edited before it's saved (FR-05).

## 7.2 Screen map

```mermaid
flowchart LR
    L["Login"] <--> R["Registration"]
    L --> D["Dashboard"]
    D --> UP["Upload"]
    UP --> AN["AI Analysis and Metadata<br/>(review and approve)"]
    AN --> DD["Document Details"]
    D --> S["Natural Language Search"]
    S --> DD
    D --> DD
    D --> ST["Profile and Settings"]
```

## 7.3 Screens

| # | Screen | Purpose | Key elements | FR / UC | Route |
|---|---|---|---|---|---|
| 1 | Login | Secure sign-in | Email, password (masked), Login button, Create Account link, validation messages | FR-01 / UC-02 | `/login` |
| 2 | Registration | Create an account | First name, last name, email, password + confirm, password-strength hints | FR-01 / UC-01 | `/register` |
| 3 | Dashboard | Overview and quick actions | Stat cards (total docs, AI classified, duplicates, storage), upload activity chart, AI activity feed, quick AI search | — | `/` |
| 4 | Document Upload | Add files | Drag-and-drop zone, file picker, supported formats, progress bar, status messages | FR-02 / UC-03 | `/upload` |
| 5 | AI Analysis and Metadata | Review AI output | Suggested title, keywords, summary, category, filename, folder path; duplicate warning; Accept / Edit buttons | FR-03–FR-05, FR-07 / UC-05–UC-08 | `/documents/:id/review` |
| 6 | Natural Language Search | Find files by meaning | Conversational search box, result cards with name, category, summary, date, relevance score | FR-06 / UC-09 | `/search` |
| 7 | Document Details | Inspect and manage one file | Preview, AI metadata, category, keywords, path, duplicate status; Edit, Rename, Move, Download, Delete | UC-10 | `/documents/:id` |
| 8 | Profile and Settings | Manage account | Profile info, change password, notifications, security options, storage usage | — | `/settings` |

## 7.4 Prototype screenshots

### Login
![Login page](images/ui-01-login.png)

### Registration
![Registration page](images/ui-02-registration.png)

### Dashboard
![Dashboard](images/ui-03-dashboard.png)

### Document upload
![Document upload page](images/ui-04-upload.png)

### AI analysis and metadata
![AI analysis and metadata page](images/ui-05-ai-analysis.png)

### Natural language search
![Natural language search page](images/ui-06-search.png)

### Document details
![Document details page](images/ui-07-document-details.png)

### Profile and settings
![Profile and settings page](images/ui-08-profile-settings.png)

## 7.5 Notes for implementation

- **Mock-up data is illustrative.** Numbers like "1,284 documents" or "97.1% AI accuracy" come from the prototype; in the real app they come from `GET /api/dashboard/stats`.
- **"Pro Plan" / "Upgrade Storage"** in the prototype imply paid tiers, which are not in the project scope. Show storage usage only, or agree a fixed quota.
- **Upload → review flow:** after upload, show a "Analysing…" state while polling `GET /api/documents/{id}/analysis`, then open the review screen.
- **Low-confidence suggestions** (below the threshold in `.env`) should be visually marked so users check them.
- **Registration fields:** the mock-up has first and last name; the database stores one `name` (decision D7 in [Architecture §4.8](04-system-architecture.md#48-decisions-to-confirm)).
