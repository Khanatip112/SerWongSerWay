# Sprint 1 Software Test Specification (STS) & Definition of Done
## Project: Review, Feedback, and Survey System (PastelPulse)
- **Version:** 1.0
- **Related Contract:** `docs/sprints/sprint-1/contracts.md`

---

## 1. Software Test Specification (STS)

| Test ID | Linked AC | Test Level | Preconditions & Input | Action | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-01** | AC-01 | API / DB Integration | Seeded user `creator1@example.com` exists in PostgreSQL. | Send `POST /api/auth/login` with valid credentials, then `GET /api/auth/me` with returned cookie. | `POST` returns `200` with `HttpOnly` cookie; `GET /api/auth/me` returns `200` with `role: "CREATOR"`. |
| **TEST-02** | AC-02 | API / DB Integration | Active session cookie for `creator1@example.com`. | Send `POST /api/auth/login` with wrong password; also test `POST /api/auth/logout` followed by `GET /api/auth/me`. | Wrong password returns `401`; after logout, `GET /api/auth/me` returns `401 Unauthorized`. |
| **TEST-03** | AC-03 | API Integration | No authentication cookie provided. | Send `GET /api/campaigns`, `POST /api/campaigns`, and `GET /api/campaigns/:id/results`. | All endpoints return `401 Unauthorized` with error envelope and zero private data. |
| **TEST-04** | AC-04 | API / DB Integration | Authenticated as `creator1@example.com` (`CREATOR`). | Send `POST /api/campaigns` with valid title, description, and 2 questions (`RATING_5`, `TEXT`). | Returns `201 Created`; querying PostgreSQL confirms campaign and 2 questions exist with `creatorId = creator1.id`. |
| **TEST-05** | AC-05 | API Integration | Authenticated as `respondent1@example.com` (`RESPONDENT`), and separately as `creator1` with invalid payload. | Send `POST /api/campaigns` as `RESPONDENT`; send `POST /api/campaigns` as `CREATOR` with empty `questions: []`. | `RESPONDENT` receives `403 Forbidden`; empty questions payload returns `400 Bad Request`. |
| **TEST-06** | AC-06 | API / DB Integration | Seeded `PUBLISHED` and `CLOSED` campaigns exist in DB. | Call `GET /api/campaigns` as `RESPONDENT` and as `CREATOR`. | `RESPONDENT` receives only `PUBLISHED` campaigns; `CREATOR` receives only their owned campaigns. |
| **TEST-07** | AC-07 | API / DB Integration | Authenticated as `respondent1@example.com`; open `PUBLISHED` campaign exists. | Send `POST /api/campaigns/:id/submissions` with rating `5` and text comment. | Returns `201 Created`; `Submission` and `Answer` records are persisted in PostgreSQL. |
| **TEST-08** | AC-08 (Sprint 1 baseline) | Unit + API / DB Integration | `respondent1@example.com` has already submitted to campaign `:id`. | Send a second `POST /api/campaigns/:id/submissions` from `respondent1@example.com`. | **Historical Sprint 1 result:** rejected with `409 Conflict` (`DUPLICATE_SUBMISSION`); DB submission count remains `1`. The amended Lab 7 behavior is specified by TEST-13/TEST-14. |
| **TEST-09** | AC-09 | Unit + API / DB Integration | Seeded `CLOSED` campaign exists; open `PUBLISHED` campaign exists. | Submit response to `CLOSED` campaign; submit rating `6` to `PUBLISHED` campaign. | `CLOSED` campaign returns `422 Unprocessable Entity`; rating `6` returns `400 Bad Request`. |
| **TEST-10** | AC-10 | API / DB Integration | `creator1` owns campaign `:id` with 2 persisted submissions (ratings `5` and `4`). | Send `GET /api/campaigns/:id/results` as `creator1@example.com`. | Returns `200 OK` with `totalSubmissions: 2`, `averageRating: 4.5`, and full answer details. |
| **TEST-11** | AC-11 | API / DB Integration | `creator1` owns campaign `:id` containing private responses; `creator2@example.com` is another `CREATOR`. | Send `GET /api/campaigns/:id/results` authenticated as `creator2@example.com`, and as `respondent1@example.com`. | Both requests are rejected with `403 Forbidden` (`FORBIDDEN_OWNER_ACCESS`) with zero submission records leaked. |
| **TEST-12** | AC-12 | E2E (Playwright) + API | Full stack running locally against seeded PostgreSQL DB. | Browser E2E: Creator logs in, creates campaign -> Respondent logs in, submits a review and revises it while open -> Creator views latest results on `#fadadd`/`#ffffff` UI -> check `GET /api/ready`. | Full UI journey succeeds; revision confirmation is shown and Creator sees latest answers; `#fadadd` theme token verified on header; `GET /api/ready` returns `200 OK`. The original Sprint 1 duplicate-rejection outcome remains documented in TEST-08 as baseline history. |
| **TEST-13** | AC-13 | API / DB Integration | Authenticated respondent has no response to an open `PUBLISHED` campaign; campaign has valid questions. | Submit a valid answer set, then submit a different valid answer set for the same campaign. | First request returns `201`; second returns `200` with `updated: true` and the same submission ID. PostgreSQL has one submission row, latest `submittedAt`, and only the replacement answer set. |
| **TEST-14** | AC-14 | API / DB Integration | Respondent has an existing submission with persisted answers. | Attempt an invalid replacement; attempt a valid replacement after the campaign is closed/expired; call as unauthenticated and as a `CREATOR`. | Invalid replacement returns `400`; closed/expired returns `422`; unauthenticated returns `401`; Creator returns `403`. On all rejected updates the existing timestamp and answers remain unchanged. |

---

## 2. TDD Execution Protocol for Sprint 1
For the accepted Sprint 1 baseline, core domain rules (`TEST-08` duplicate prevention, `TEST-09` closed campaign / rating bounds, and `TEST-11` ownership enforcement) were specified before implementation. The baseline outcomes above are retained as history.
1. Commit `docs/` engineering contracts first (`spec: add Sprint 1 contracts and STS`).
2. Write automated tests (`TEST-08`, `TEST-09`, `TEST-11`) before implementing the rule guards, run `npm test`, and capture failing test output (`RED`).
3. Implement backend validation/guards and Prisma constraints, re-run `npm test`, and capture passing test output (`GREEN`).

### Lab 7 Maintenance TDD Gate

Before implementing FR-11/BR-06, the engineering contract and second-member
review must be complete. Add/adjust TEST-13 and TEST-14 first, verify the
revision and failure-preserves-data expectations, then implement and run the
targeted tests. This proposal records no RED/GREEN output and does not claim
that these tests have been implemented or executed.

---

## 3. Product Definition of Done (DoD) — Sprint 1
A Sprint 1 increment is considered **Done** only when all conditions below are verified with concrete evidence:
1. **Specification & Traceability:** Parts A–E (`docs/srs.md`, `docs/features.md`, `docs/traceability.md`, `docs/system-sds.md`, `docs/sprints/plan.md`, and `docs/sprints/sprint-1/*`) are committed and up to date.
2. **Working Vertical Slice:** Application runs locally via documented commands in `README.md` with PostgreSQL migrations and deterministic seed data.
3. **Rule & Security Enforcement:** Real login/logout, role separation (`CREATOR` / `RESPONDENT`), duplicate rejection (`BR-01`), closed-campaign rejection (`BR-02`), and backend ownership protection (`BR-04`) are enforced at the API and database layers.
4. **Automated Verification:** All planned unit, API/DB integration, and Playwright E2E tests (`TEST-01` through `TEST-12`) pass on the release commit, with TDD before/after evidence preserved.
5. **Reviewed Git Integration:** Features are developed on branches off `staging`, reviewed and approved by the teammate (never self-approved) with substantive review comments, integrated into `staging`, and released via PR into `main` with a release tag.
6. **Clean Repository Hygiene:** Zero plaintext passwords, tokens, or real `.env` secrets are committed to Git; any known limitations are explicitly documented in Part F.

The Sprint 1 DoD above remains historical baseline evidence. For this Lab 7
maintenance change, completion additionally requires AC-13/AC-14 and
TEST-13/TEST-14 to be implemented and verified after the contract and
second-member review; no instructor/TA approval gate is added.