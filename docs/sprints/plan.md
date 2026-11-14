# Three-Sprint Delivery Plan
## Project: Review, Feedback, and Survey System (PastelPulse)
- **Version:** 1.0
- **Schedule:** Semester 1/2026 (Deliverable 1: 8 Nov | Deliverable 2: 29 Nov | Final Release: 13 Dec)

---

## 1. Sprint Roadmap Overview

| Sprint | Checkpoint Date | Primary Sprint Goal | Included Feature IDs | Dependencies | Required Completion Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sprint 1** | **8 Nov 2026** (Deliverable 1) | Deliver an authenticated, tested vertical slice covering campaign creation, single-submission feedback collection, duplicate/closed rejection rules, ownership enforcement, and Pastel Pink (`#fadadd`) UI. | **F-01, F-02, F-03, F-04** (`SYS-UI`, `SYS-OPS`) | Baseline SRS, SDS, PostgreSQL schema & seed data | Working local app on `main`; seeded `CREATOR` & `RESPONDENT` accounts; automated unit, API/DB integration, and E2E tests passing; teammate-reviewed PRs merged via `staging`. |
| **Sprint 2** | **29 Nov 2026** (Deliverable 2) | Expand core campaign lifecycle (`DRAFT` / `PUBLISHED` / `CLOSED`), enable draft editing with post-submission question lock, and add Respondent submission history. | **F-05, F-06, F-07** | Sprint 1 vertical slice (`F-01`–`F-04`) | Creators can save drafts, edit questions safely (`BR-05`), and close campaigns (`FR-03`); Respondents can view their feedback history (`FR-07`); full regression tests passing. |
| **Sprint 3** | **13 Dec 2026** (Final Project) | Deliver Creator result filtering/search, CSV report export, full UAT bug fixes, and final product hardening. | **F-08** + Hardening | Sprint 2 complete (`F-05`–`F-07`) | Creators can filter feedback by star rating/keywords (`FR-09`) and export CSV summaries (`FR-10`); all baseline `FR/BR/NFR` verified end-to-end. |

---

## 2. Sprint 1 Scope Justification
Sprint 1 intentionally focuses on **F-01 through F-04** so the team delivers a complete, high-integrity end-to-end domain journey rather than partially built screens:
1. **Authentication & Role Separation (`F-01`):** Establishes real `CREATOR` and `RESPONDENT` identities and backend session verification.
2. **Creator Campaign Creation (`F-02`):** Enables creating real survey/review forms stored in PostgreSQL.
3. **Respondent Submission & Core Rules (`F-03`):** Exercises the primary domain transaction and enforces `BR-01` (no duplicate submissions), `BR-02` (reject closed campaigns), and `BR-03` (1–5 rating validation).
4. **Persisted Results & Ownership Guard (`F-04`):** Proves data durability across requests and enforces `BR-04` (preventing unauthorized access to another Creator's results).