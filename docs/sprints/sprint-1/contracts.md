# Sprint 1 Engineering Contracts
## Project: Review, Feedback, and Survey System (PastelPulse)
- **Version:** 1.0 (Pre-Implementation Contract)
- **Included Features:** `F-01`, `F-02`, `F-03`, `F-04`, `SYS-UI`, `SYS-OPS`

---

## Contract 1: `F-01` Session Authentication & Role Identity
- **Linked Requirements:** `FR-01`, `NFR-01`, `NFR-02`
- **Dependencies:** PostgreSQL `User` table and seed accounts.

### API Specification
1. **`POST /api/auth/login`**
   - Request Body: `{ "email": "creator1@example.com", "password": "Password123!" }`
   - Success (`200 OK`): Sets `HttpOnly` cookie `pastelpulse_session` and returns `{ "data": { "id": "uuid", "email": "creator1@example.com", "fullName": "Alice Creator", "role": "CREATOR" } }`.
   - Failure (`401 Unauthorized`): Invalid email or password -> `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." } }`.
2. **`GET /api/auth/me`**
   - Success (`200 OK`): Returns `{ "data": { "id": "uuid", "email": "...", "fullName": "...", "role": "..." } }`.
   - Failure (`401 Unauthorized`): Missing or expired session cookie -> `{ "error": { "code": "UNAUTHENTICATED", "message": "Authentication required." } }`.
3. **`POST /api/auth/logout`**
   - Success (`200 OK`): Clears `pastelpulse_session` cookie and returns `{ "data": { "loggedOut": true } }`.

### Acceptance Criteria (`F-01`)
- **AC-01 (Valid Login & Identity):** Submitting valid credentials for a seeded `CREATOR` or `RESPONDENT` returns HTTP `200`, sets an `HttpOnly` session cookie, and subsequent `GET /api/auth/me` returns the exact user profile and role.
- **AC-02 (Invalid Login & Logout):** Submitting an incorrect password returns HTTP `401` without setting a session cookie; calling `POST /api/auth/logout` invalidates the session so subsequent `GET /api/auth/me` returns HTTP `401`.
- **AC-03 (Unauthenticated Access Rejection):** Calling any protected endpoint (`GET /api/campaigns`, `POST /api/campaigns`, `GET /api/campaigns/:id/results`) without a valid session cookie returns HTTP `401 Unauthorized` with zero private records in the response body.

---

## Contract 2: `F-02` Campaign Creation & Browsing
- **Linked Requirements:** `FR-02`, `FR-04`, `BR-03`, `NFR-03`
- **Dependencies:** `F-01`, PostgreSQL `Campaign` and `Question` tables.

### API & UI Specification
1. **`POST /api/campaigns`** (`CREATOR` only)
   - Request Body:
         {
           "title": "Lab Workshop Feedback",
           "description": "Rate today's software engineering lab.",
           "closesAt": "2026-12-31T23:59:59Z",
           "questions": [
             { "prompt": "Overall satisfaction", "type": "RATING_5", "required": true },
             { "prompt": "What can we improve?", "type": "TEXT", "required": true }
           ]
         }
   - Success (`201 Created`): Persists `Campaign` (`status: "PUBLISHED"`) and ordered `Question` rows in a single DB transaction; returns `{ "data": { "id": "uuid", ... } }`.
   - Failure (`400 Bad Request`): Empty title, empty `questions` array, or invalid question type.
   - Failure (`403 Forbidden`): Authenticated user has role `RESPONDENT`.
2. **`GET /api/campaigns`** (Authenticated users)
   - If `role === "CREATOR"`: Returns only campaigns where `creatorId === req.user.id`.
   - If `role === "RESPONDENT"`: Returns all campaigns where `status === "PUBLISHED"`, annotated with `hasSubmitted: boolean` for the current respondent.

### Acceptance Criteria (`F-02`)
- **AC-04 (Create Valid Campaign):** An authenticated `CREATOR` submitting a valid campaign payload receives HTTP `201`, and the campaign with all questions is persisted in PostgreSQL.
- **AC-05 (Reject Invalid Campaign Payload or Wrong Role):** Submitting a campaign with an empty title or zero questions returns HTTP `400`; a `RESPONDENT` calling `POST /api/campaigns` is rejected with HTTP `403 Forbidden`.
- **AC-06 (Role-Scoped Campaign Listing):** `GET /api/campaigns` returns only owned campaigns for a `CREATOR` and only `PUBLISHED` campaigns for a `RESPONDENT`.

---

## Contract 3: `F-03` Feedback & Survey Submission
- **Linked Requirements:** `FR-05`, `BR-01`, `BR-02`, `BR-03`, `NFR-03`; proposed Lab 7 amendment `FR-11` / `BR-06`
- **Dependencies:** `F-01`, `F-02`, PostgreSQL `Submission` and `Answer` tables.

### API & Domain Rule Specification
1. **`POST /api/campaigns/:id/submissions`** (`RESPONDENT` only)
   - Request Body:
         {
           "answers": [
             { "questionId": "q-uuid-1", "ratingValue": 5 },
             { "questionId": "q-uuid-2", "textValue": "Very clear instructions!" }
           ]
         }
   - Execution Order & Guards (current Lab 7 proposal):
     1. Verify `req.user.role === "RESPONDENT"` (else `403 Forbidden`).
     2. Fetch campaign by `:id` (if missing -> `404 Not Found`).
     3. Check `campaign.status === "PUBLISHED"` and (`campaign.closesAt === null` or `campaign.closesAt > now()`) (else `422 Unprocessable Entity`, code `CAMPAIGN_NOT_OPEN` — enforces `BR-02`).
     4. Validate payload shape, question membership, required answers, and rating bounds before any data mutation (else `400 Bad Request` — enforces `BR-03`).
     5. If the respondent has no submission, insert the `Submission` and `Answer` rows atomically and return `201 Created`.
     6. If a submission exists, atomically update its `submittedAt` and replace its `Answer` rows; retain its ID and return `200 OK` with `updated: true` (enforces proposed `BR-06`).
     7. Preserve the unique constraint `(campaignId, respondentId)`. A concurrent write conflict returns `409 Conflict`, code `SUBMISSION_CONFLICT`, without creating a second row or leaving partially replaced answers.
   - First-submit success (`201 Created`): Returns `{ "data": { "submissionId": "uuid", "campaignId": "uuid", "submittedAt": "..."} }`.
   - Revision success (`200 OK`): Returns `{ "data": { "submissionId": "uuid", "campaignId": "uuid", "submittedAt": "...", "updated": true } }`.

### Acceptance Criteria (`F-03`)
- **AC-07 (Valid Submission Persistence):** An authenticated `RESPONDENT` submitting valid answers to an open `PUBLISHED` campaign receives HTTP `201`, and the `Submission` and `Answer` records are durably stored in PostgreSQL.
- **AC-08 (Sprint 1 baseline — `BR-01`):** In the accepted Sprint 1 baseline, when the same `RESPONDENT` submits a second response to a campaign they already submitted to, the API rejects the request with HTTP `409 Conflict` (`DUPLICATE_SUBMISSION`) and stores no second `Submission` record. The duplicate-rejection outcome is superseded for the Lab 7 maintenance contract by BR-06 and AC-13/AC-14; the one-record invariant remains.
- **AC-09 (Reject Closed Campaign & Out-of-Range Rating — `BR-02`, `BR-03`):** Submitting to a `CLOSED` campaign returns HTTP `422 Unprocessable Entity`; submitting a rating of `0` or `6` returns HTTP `400 Bad Request`.

### Lab 7 Maintenance Amendment — Existing Submission Revision

The following criteria amend the current F-03 contract without changing the
accepted Sprint 1 baseline history. They are specified before implementation;
TEST-13 and TEST-14 are planned, not executed.

- **AC-13 (Revise Existing Response — `FR-11`, `BR-06`):** A valid first response continues to return `201 Created`. When the same authenticated `RESPONDENT` submits a second valid answer set to the same open `PUBLISHED` campaign, the API returns `200 OK` with `updated: true`, the same `submissionId`, and a later `submittedAt`. PostgreSQL contains exactly one submission record for that respondent/campaign, and its persisted answers are exactly the replacement answer set (no stale answers remain).
- **AC-14 (Revision Guards and Atomicity — `BR-02`, `BR-03`, `BR-06`):** An invalid replacement answer set returns `400 Bad Request` and leaves the existing submission timestamp and answers unchanged. A revision attempt after the campaign is `CLOSED` or its deadline has elapsed returns `422 Unprocessable Entity` (`CAMPAIGN_NOT_OPEN`) and leaves the existing response unchanged. An unauthenticated caller receives `401`; an authenticated non-`RESPONDENT` receives `403`. A concurrent write conflict returns `409 SUBMISSION_CONFLICT` and leaves one complete committed answer set.

---

## Contract 4: `F-04` Creator Results Dashboard, Ownership Guard & System Readiness
- **Linked Requirements:** `FR-06`, `BR-04`, `NFR-03`, `NFR-04`, `NFR-05`
- **Dependencies:** `F-01`, `F-02`, `F-03`.

### API & UI Specification
1. **`GET /api/campaigns/:id/results`** (`CREATOR` owner only)
   - Guard: Verify `req.user.role === "CREATOR"` AND `campaign.creatorId === req.user.id`. Otherwise return `403 Forbidden` (`FORBIDDEN_OWNER_ACCESS`) with zero submission data (`BR-04`).
   - Success (`200 OK`):
         {
           "data": {
             "campaign": { "id": "uuid", "title": "...", "status": "PUBLISHED" },
             "summary": { "totalSubmissions": 2, "averageRating": 4.5 },
             "submissions": [
               {
                 "id": "sub-uuid",
                 "respondentName": "Bob Respondent",
                 "submittedAt": "2026-11-05T10:00:00Z",
                 "answers": [
                   { "questionPrompt": "Overall satisfaction", "type": "RATING_5", "ratingValue": 5, "textValue": null },
                   { "questionPrompt": "What can we improve?", "type": "TEXT", "ratingValue": null, "textValue": "Great lab!" }
                 ]
               }
             ]
           }
         }
2. **`GET /api/ready`** (Public readiness check — `NFR-05`)
   - Executes `SELECT 1` against PostgreSQL and returns `200 OK` `{ "status": "ready", "database": "connected" }`.

### Acceptance Criteria (`F-04` & `SYS`)
- **AC-10 (Retrieve Persisted Campaign Results):** The owning `CREATOR` calling `GET /api/campaigns/:id/results` (and viewing `/campaigns/:id/results` in the UI) receives HTTP `200` with accurate `totalSubmissions`, `averageRating`, and all persisted respondent answers.
- **AC-11 (Enforce Ownership & Role Restrictions — `BR-04`):** A different `CREATOR` (`creator2`) or any `RESPONDENT` calling `GET /api/campaigns/:id/results` for `creator1`'s campaign is rejected by the backend API with HTTP `403 Forbidden` without returning private submission data.
- **AC-12 (Pastel Pink Theme & Readiness Health Check — `NFR-04`, `NFR-05`):** The UI renders using the `#fadadd` Pastel Pink primary theme with `#ffffff` white cards/tabs, `#1a1a1a` black text, and `#dc2626` red validation alerts; `GET /api/ready` returns HTTP `200` confirming live database connectivity.