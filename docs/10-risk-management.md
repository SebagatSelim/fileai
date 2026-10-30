# 10. Risk Management

Source: Project Proposal, Section 9. Risks R1–R6 come from the proposal; R7–R10 were added for the implementation phase.

## 10.1 Approach

- Risks are reviewed at every **weekly team meeting**.
- New risks are added to this register as they come up during development and testing.
- Technical risks (AI, OCR, database, cloud) are controlled through continuous testing and validation (NIST, 2023).
- Schedule and integration risks are controlled by tracking milestones, re-allocating tasks and regular communication.

**Score** = Likelihood × Impact (Low = 1, Medium = 2, High = 3). Score ≥ 6 is reviewed every week.

## 10.2 Risk register

| ID | Risk | Likelihood | Impact | Score | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| R1 | AI classifies documents incorrectly | Medium | High | 6 | User reviews and edits all AI metadata, filenames, categories and folders before saving; show confidence; test with a labelled document set | _TBD_ | Open |
| R2 | OCR gives inaccurate text for low-quality scans | Medium | High | 6 | Image pre-processing (greyscale, threshold, deskew); user can edit extracted text and metadata | _TBD_ | Open |
| R3 | Natural-language search returns irrelevant results | Medium | Medium | 4 | Better metadata, hybrid semantic + keyword ranking, tune weights with a search test set | _TBD_ | Open |
| R4 | Unauthorised access to accounts or documents | Low | High | 3 | HTTPS, JWT, BCrypt, per-user access checks on every query, private S3 bucket with pre-signed URLs | _TBD_ | Open |
| R5 | Files lost through storage or database failure | Low | High | 3 | Regular database backups; S3 versioning and redundancy | _TBD_ | Open |
| R6 | Delays in AI integration, testing or development | Medium | Medium | 4 | Agile sprints, weekly meetings, milestone tracking, start AI work early with a simple version | _TBD_ | Open |
| R7 | AI API cost or rate limits exceed budget | Medium | Medium | 4 | Truncate text sent to the model; cache results; set a spending limit; local Hugging Face fallback | _TBD_ | Open |
| R8 | Sending personal documents to a third-party AI raises privacy concerns | Medium | Medium | 4 | Privacy notice; send only extracted text, not files; option to use a local model; test with non-sensitive sample documents | _TBD_ | Open |
| R9 | Secrets (AWS keys, API keys) leaked in Git | Low | High | 3 | `.env` in `.gitignore`; `.env.example` only; rotate keys immediately if exposed; least-privilege IAM user | _TBD_ | Open |
| R10 | Team member unavailable (illness, workload) | Medium | Medium | 4 | Pair on critical modules; keep docs current; code reviews spread knowledge | _TBD_ | Open |

## 10.3 Risk matrix

| Likelihood ↓ / Impact → | Low | Medium | High |
|---|---|---|---|
| **High** | | | |
| **Medium** | | R3, R6, R7, R8, R10 | **R1, R2** |
| **Low** | | | R4, R5, R9 |
