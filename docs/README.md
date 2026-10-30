# Documentation

Project documentation for the **AI-Powered Personal Digital File Organizer** (Group 4, NIT3003/NIT3004, Victoria University).

| # | Document | What's in it |
|---|---|---|
| 1 | [Project Overview](01-project-overview.md) | Problem, market, competitors, gap, aim, SMART objectives, scope |
| 2 | [Requirements Specification](02-requirements-specification.md) | FR-01 – FR-11, NFR-01 – NFR-07, traceability matrix |
| 3 | [Use Cases](03-use-cases.md) | Actors, use case diagram, UC-01 – UC-10 |
| 4 | [System Architecture](04-system-architecture.md) | Layers, tech stack, processing pipeline, search design, 5 sequence diagrams, security, open decisions |
| 5 | [Database Design](05-database-design.md) | ER diagram, all tables, rules, backups |
| 6 | [API Specification](06-api-specification.md) | REST endpoints with request/response examples (draft) |
| 7 | [UI Design](07-ui-design.md) | Screen map, 8 screens with prototype screenshots |
| 8 | [Algorithms and Pseudocode](08-algorithms-pseudocode.md) | Authentication, document processing, search, similarity, ranking |
| 9 | [Project Plan](09-project-plan.md) | Team, Agile method, milestones, Gantt chart, sprint plan, resources |
| 10 | [Risk Management](10-risk-management.md) | Risk register and matrix |
| 11 | [Testing Strategy](11-testing-strategy.md) | Test levels, test cases, NFR verification, AI evaluation |
| 12 | [References](12-references.md) | APA 7th edition reference list |

## How these docs relate to the proposal

Sections 1, 2, 3, 7, 9, 10 and 12 restate the submitted proposal in a developer-friendly format. The following were **added** for the implementation phase and should be reviewed by the team:

- Document Metadata table columns and four extra tables (`folders`, `document_keywords`, `document_embeddings`, `audit_logs`)
- The REST API specification
- Background processing, scanned-PDF OCR fallback, and hybrid search ranking
- Redrawn sequence diagrams (Figures 5–8 in the proposal did not export correctly)
- Two extra pseudocode procedures (similarity, ranking)
- Risks R7–R10, sprint plan, testing strategy
- A list of open technical decisions ([Architecture §4.8](04-system-architecture.md#48-decisions-to-confirm))

## Keeping docs up to date

- Change the docs **in the same pull request** as the code that changes the behaviour.
- Diagrams are written in [Mermaid](https://mermaid.js.org/) so they render on GitHub and can be edited as text.
- Images live in [`images/`](images/).
