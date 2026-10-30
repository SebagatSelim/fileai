# Contributing Guide

How Group 4 works together in this repository.

## Branches

```text
main       ← stable, demo-ready. Only updated from develop at milestones.
develop    ← integration branch. All feature work merges here.
feature/*  ← one branch per task, created from develop.
fix/*      ← bug fixes, created from develop.
docs/*     ← documentation-only changes.
```

Examples: `feature/auth-login`, `feature/upload-dropzone`, `feature/ai-metadata`, `fix/ocr-empty-text`, `docs/api-search`.

## Everyday workflow

```bash
git checkout develop
git pull
git checkout -b feature/upload-dropzone
```

```bash
git add .
git commit -m "feat(upload): add drag-and-drop zone [FR-02]"
git push -u origin feature/upload-dropzone
```

Then open a pull request into `develop` on GitHub.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) and add the requirement ID when there is one:

```text
<type>(<area>): <what changed> [FR-xx]
```

| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or fixing tests |
| `refactor` | Code change that doesn't change behaviour |
| `chore` | Tooling, config, dependencies |

Examples:

- `feat(auth): hash passwords with bcrypt [FR-01]`
- `fix(ocr): fall back to OCR for scanned PDFs [FR-09]`
- `docs(api): document search endpoint`

## Pull requests

- One task per PR; keep them small.
- Fill in the PR template (what, which FR/UC, how tested).
- At least **one approval** from another team member before merging.
- Tests must pass.
- Update `docs/` in the same PR if behaviour or the API changes.
- Use **Squash and merge** into `develop`.

## Never commit

- `.env` files, AWS keys, OpenAI keys, passwords
- Real personal documents (use the sample test set)
- `node_modules/`, `.venv/`, build output

If a secret is committed by mistake, tell the team and **rotate the key immediately** — deleting the commit is not enough.

## Code style

| Area | Style |
|---|---|
| Python | PEP 8, formatted with `black`, linted with `ruff` |
| JavaScript/React | `prettier` + `eslint`; function components and hooks |
| SQL | Uppercase keywords, `snake_case` names |
| Naming | Python `snake_case`; React components `PascalCase`; API paths lowercase with hyphens |

## Issues and the project board

- Every task and bug is a GitHub Issue, labelled `frontend`, `backend`, `ai`, `database`, `docs`, `bug`.
- Link the issue in the PR (`Closes #12`) so it moves to Done automatically.
- Review the board at the weekly team meeting.
