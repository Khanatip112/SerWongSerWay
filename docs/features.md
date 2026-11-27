# Feature Inventory
## Project: Review, Feedback, and Survey System (PastelPulse)
- **Version:** 1.0
- **Related Documents:** `docs/srs.md`, `docs/traceability.md`, `docs/sprints/plan.md`

---

## 1. Feature Catalog

| Feature ID | Feature Name | Description | Linked Requirements | Dependencies | Planned Sprint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-01** | Session Authentication & Role Identity | Login endpoint, logout endpoint, current-user (`/api/auth/me`) endpoint, `HttpOnly` cookie session handling, and role guard middleware (`CREATOR`, `RESPONDENT`). | FR-01, NFR-01, NFR-02, NFR-05 | None (Foundation) | Sprint 1 |
| **F-02** | Campaign Creation & Publishing (Core) | UI and API allowing a `CREATOR` to create a survey/review campaign with title, description, optional deadline, and rating/text questions in `PUBLISHED` state, plus listing campaigns by role. | FR-02, FR-04, BR-03, NFR-03, NFR-04 | F-01 | Sprint 1 |
| **F-03** | Feedback & Survey Submission | UI and API allowing a `RESPONDENT` to open a `PUBLISHED` campaign, submit 1–5 star ratings and text feedback, and revise their existing answer set while the campaign is open. Maintains one submission record (`BR-01`), applies open status (`BR-02`) and payload validation (`BR-03`), and implements the Lab 7 amendment (`FR-11`, `BR-06`). | FR-05, FR-11, BR-01, BR-02, BR-03, BR-06, NFR-03, NFR-04 | F-01, F-02 | Sprint 1 behavior; Lab 7 maintenance amendment |
| **F-04** | Creator Results Dashboard & Ownership Guard | UI and API allowing a `CREATOR` to view aggregated average rating, total response count, and individual feedback entries strictly for campaigns they own (`BR-04`). | FR-06, BR-04, NFR-01, NFR-03, NFR-04 | F-01, F-02, F-03 | Sprint 1 |
| **F-05** | Campaign Lifecycle State Transitions (`DRAFT` / `CLOSED`) | Ability for a `CREATOR` to save campaigns as `DRAFT`, publish drafts to `PUBLISHED`, and manually close active campaigns to `CLOSED`. | FR-03, BR-02, BR-04 | F-02 | Sprint 2 |
| **F-06** | Draft Campaign Editor & Question Lock | UI and API to edit campaign metadata and questions while in `DRAFT` or before any submission exists (`BR-05`). | FR-08, BR-04, BR-05 | F-02, F-05 | Sprint 2 |
| **F-07** | Respondent Submission History | Dedicated tab/view for `RESPONDENT` users to inspect all campaigns they have previously reviewed and their submitted answers. | FR-07, NFR-01 | F-01, F-03 | Sprint 2 |
| **F-08** | Results Filtering & CSV Export | Creator dashboard controls to filter responses by star rating, search text comments, and download a sanitized CSV report. | FR-09, FR-10, BR-04 | F-04 | Sprint 3 |

---

## 2. Cross-Cutting System Responsibilities
- **Design System & Theme Engine (`SYS-UI`):** Implements the `#fadadd` Pastel Pink theme tokens, white card/tab containers (`#ffffff`), black typography (`#1a1a1a`), red validation/error banners (`#dc2626`), and reusable Loading, Empty, and Error UI states across all features (`NFR-04`).
- **Cloud-Ready Health & Config Layer (`SYS-OPS`):** Centralizes environment variable validation and exposes `GET /api/ready` to verify PostgreSQL connectivity (`NFR-05`).