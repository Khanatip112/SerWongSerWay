# Requirements Traceability Matrix
## Project: Review, Feedback, and Survey System (PastelPulse)
- **Version:** 1.0
- **Purpose:** Maps every baseline requirement (`FR`, `BR`, `NFR`) to features, sprints, acceptance criteria, and automated tests.

---

## 1. End-to-End Traceability Table

| Req ID | Requirement Summary | Feature / Responsibility | Planned Sprint | Sprint 1 Contract AC | Verification Test ID | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-01** | Login, logout, current-user identity | F-01 Session Authentication & Role Identity | Sprint 1 | AC-01, AC-02, AC-03 | TEST-01, TEST-02, TEST-03 | Specified (Sprint 1) |
| **FR-02** | Create review/survey campaign | F-02 Campaign Creation & Publishing | Sprint 1 | AC-04, AC-05 | TEST-04, TEST-05 | Specified (Sprint 1) |
| **FR-03** | Publish & close campaign lifecycle | F-05 Campaign Lifecycle State Transitions | Sprint 2 | — (Deferred to Sprint 2) | — | Planned (Sprint 2) |
| **FR-04** | Browse available/owned campaigns | F-02 Campaign Creation & Publishing | Sprint 1 | AC-06 | TEST-06 | Specified (Sprint 1) |
| **FR-05** | Submit feedback/survey response | F-03 Feedback & Survey Submission | Sprint 1 | AC-07 | TEST-07 | Specified (Sprint 1) |
| **FR-06** | View persisted campaign results | F-04 Creator Results Dashboard | Sprint 1 | AC-10 | TEST-10 | Specified (Sprint 1) |
| **FR-07** | View personal submission history | F-07 Respondent Submission History | Sprint 2 | — (Deferred to Sprint 2) | — | Planned (Sprint 2) |
| **FR-08** | Edit draft campaign | F-06 Draft Campaign Editor | Sprint 2 | — (Deferred to Sprint 2) | — | Planned (Sprint 2) |
| **FR-09** | Filter & search feedback results | F-08 Results Filtering & CSV Export | Sprint 3 | — (Deferred to Sprint 3) | — | Planned (Sprint 3) |
| **FR-10** | Export campaign summary (CSV) | F-08 Results Filtering & CSV Export | Sprint 3 | — (Deferred to Sprint 3) | — | Planned (Sprint 3) |
| **BR-01** | Prevent duplicate submission per user | F-03 Feedback & Survey Submission | Sprint 1 | AC-08 | TEST-08 | Specified (Sprint 1) |
| **BR-02** | Reject submission to non-open campaign | F-03 Feedback & Survey Submission | Sprint 1 | AC-09 | TEST-09 | Specified (Sprint 1) |
| **BR-03** | Validate rating range (1–5) & required inputs | F-02, F-03 Validation Layer | Sprint 1 | AC-05, AC-09 | TEST-05, TEST-09 | Specified (Sprint 1) |
| **BR-04** | Enforce Creator ownership on results/mutations | F-04 Creator Results Dashboard | Sprint 1 | AC-11 | TEST-11 | Specified (Sprint 1) |
| **BR-05** | Lock questions after first submission | F-06 Draft Campaign Editor | Sprint 2 | — (Deferred to Sprint 2) | — | Planned (Sprint 2) |
| **NFR-01** | Reject unauthenticated protected requests | F-01 Auth Middleware | Sprint 1 | AC-03 | TEST-03 | Specified (Sprint 1) |
| **NFR-02** | Bcrypt password hashing & no secrets in Git | F-01 Auth & Repo Hygiene | Sprint 1 | AC-01 | TEST-01 | Specified (Sprint 1) |
| **NFR-03** | Durable PostgreSQL persistence & integrity | F-02, F-03, F-04 Persistence | Sprint 1 | AC-07, AC-10 | TEST-07, TEST-10 | Specified (Sprint 1) |
| **NFR-04** | Pastel Pink (`#fadadd`) theme & UI states | `SYS-UI` Design System | Sprint 1 | AC-12 | TEST-12 | Specified (Sprint 1) |
| **NFR-05** | Env-based config & `/api/ready` DB check | `SYS-OPS` Readiness Endpoint | Sprint 1 | AC-12 | TEST-12 | Specified (Sprint 1) |

---

## 2. Coverage Gaps & Approved Changes
- **Coverage Gaps:** All 10 Functional Requirements, 5 Business Rules, and 5 Non-Functional Requirements are mapped to a feature and target sprint. Zero requirements are orphaned.
- **Sprint 1 Scope Boundaries:** `FR-03`, `FR-07`, `FR-08`, `FR-09`, `FR-10`, and `BR-05` are intentionally scheduled for Sprints 2 and 3. In Sprint 1, newly created campaigns default to `PUBLISHED` status (with seeded `CLOSED` campaigns used to verify `BR-02` rejection behavior).
- **Approved Baseline Changes:** None (v1.0 initial baseline).