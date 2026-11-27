# System-Level Software Design Specification (SDS)
## Project: Review, Feedback, and Survey System (PastelPulse)
- **Version:** 1.0
- **Scope:** Architecture, Data Model, UI Theme & Conventions, API Design, Security, and Cloud Deployment Plan

---

## 1. Architecture & Technology Stack

### 1.1 Selected Stack
- **Frontend (`client/`):** React 18 + TypeScript + Vite + React Router + CSS Variables Design System.
- **Backend (`server/`):** Node.js 20 + Express + TypeScript + Zod (request schema validation).
- **Database & ORM:** PostgreSQL 16 + Prisma ORM (schema migrations and deterministic seeding).
- **Automated Testing:** Vitest + Supertest (unit and API/DB integration tests) + Playwright (end-to-end browser tests).

### 1.2 Component Responsibilities & Communication
    +-------------------+       HTTP/JSON (Cookies)       +--------------------+       Prisma ORM / TCP       +------------------+
    |   React Client    | <-----------------------------> |  Express REST API  | <--------------------------> |  PostgreSQL 16   |
    | (UI & State Only) |                                 | (Auth, RBAC, Rules)|                              | (Durable Storage)|
    +-------------------+                                 +--------------------+                              +------------------+

- **React Client:** Renders views, enforces client-side input feedback, and displays Loading, Empty, and Error states. Never trusted for authorization or business rule enforcement.
- **Express REST API:** Verifies `HttpOnly` JWT session cookies, enforces role permissions (`CREATOR` vs. `RESPONDENT`) and ownership rules (`BR-04`), validates input payloads via Zod (`BR-03`), and executes transactional business logic (`BR-01`, `BR-02`, and the proposed `BR-06` revision rule).
- **PostgreSQL 16:** Persists users, campaigns, questions, submissions, and answers. Enforces relational integrity (`ON DELETE CASCADE`) and composite uniqueness (`@@unique([campaignId, respondentId])`); revisions replace answers under the existing submission row.

---

## 2. Data Model & Database Design

### 2.1 Entity-Relationship Overview
    User (1) ----< Campaign (1) ----< Question
      |                |                  |
      |                v                  v
      +--------< Submission (1) ----< Answer

### 2.2 Schema Definitions & Constraints
1. **`User`**
   - `id` (String, UUID, PK)
   - `email` (String, Unique, Not Null)
   - `passwordHash` (String, Not Null — `bcrypt` hash)
   - `fullName` (String, Not Null)
   - `role` (Enum: `CREATOR` | `RESPONDENT`, Not Null)
   - `createdAt` (DateTime, Default `now()`)
2. **`Campaign`**
   - `id` (String, UUID, PK)
   - `creatorId` (String, FK -> `User.id`, Not Null) — *Ownership link*
   - `title` (String, Not Null, min 3 chars)
   - `description` (String, Not Null)
   - `status` (Enum: `DRAFT` | `PUBLISHED` | `CLOSED`, Default `PUBLISHED`)
   - `closesAt` (DateTime, Nullable)
   - `createdAt` (DateTime, Default `now()`)
3. **`Question`**
   - `id` (String, UUID, PK)
   - `campaignId` (String, FK -> `Campaign.id`, Not Null)
   - `prompt` (String, Not Null)
   - `type` (Enum: `RATING_5` | `TEXT`, Not Null)
   - `required` (Boolean, Default `true`)
   - `orderIndex` (Int, Not Null)
4. **`Submission`**
   - `id` (String, UUID, PK)
   - `campaignId` (String, FK -> `Campaign.id`, Not Null)
   - `respondentId` (String, FK -> `User.id`, Not Null)
   - `submittedAt` (DateTime, Default `now()`; under proposed BR-06, updated on each successful revision)
   - **Constraint:** `@@unique([campaignId, respondentId])` — *Enforces the one-record invariant in BR-01*
5. **`Answer`**
   - `id` (String, UUID, PK)
   - `submissionId` (String, FK -> `Submission.id`, Not Null)
   - `questionId` (String, FK -> `Question.id`, Not Null)
   - `ratingValue` (Int, Nullable — must be `1..5` when `Question.type == RATING_5`)
   - `textValue` (String, Nullable)
   - **Revision semantics (proposed):** Answers belong to the single current response. A successful revision atomically replaces the previous answer set; older answer versions are not retained.

### 2.3 Migrations & Reproducible Seed Data
- Schema changes are tracked via `prisma migrate dev` (and `prisma migrate deploy` in production).
- Running `npm run db:seed` executes an idempotent `prisma/seed.ts` script creating:
  - `creator1@example.com` (Role: `CREATOR`, Password: `Password123!`)
  - `creator2@example.com` (Role: `CREATOR`, Password: `Password123!`) — *Used to test cross-creator 403 ownership isolation*
  - `respondent1@example.com` (Role: `RESPONDENT`, Password: `Password123!`)
  - `respondent2@example.com` (Role: `RESPONDENT`, Password: `Password123!`)
  - 2 sample campaigns owned by `creator1@example.com`: one `PUBLISHED` campaign ("CPE 334 Course Experience Survey") and one `CLOSED` campaign ("Archived Orientation Feedback") for deterministic testing of `BR-02`.

---

## 3. UI Design System, Theme Specification & Shared States

### 3.1 Pastel Pink Color Palette (`NFR-04`)
The application implements a cohesive, high-contrast **Pastel Pink (`#fadadd`)** design system using global CSS variables:

| Token Name | Hex Value | Visual Role & Usage | Contrast / Accessibility Note |
| :--- | :--- | :--- | :--- |
| `--color-brand-pastel` | **`#fadadd`** | Primary brand theme color: top navigation bar background, active tab highlight pill, hero header accent, and subtle section borders. | Soft pastel pink base (`#fadadd`). |
| `--color-brand-hover` | **`#f4c2c7`** | Hover and pressed states on Pastel Pink interactive controls and secondary pills. | Distinct tactile feedback state. |
| `--color-bg-page` | **`#fdf6f7`** | Main application viewport background (ultra-light blush tint harmonizing with `#fadadd`). | Reduces glare while framing white cards. |
| `--color-surface-card` | **`#ffffff`** | Primary content cards, survey form containers, modal dialogs, and tab content panels (Pure White). | Clean separation from page background. |
| `--color-border-subtle` | **`#e5d0d3`** | Card outlines, table dividers, and form input default borders. | Crisp structural boundary. |
| `--color-text-primary` | **`#1a1a1a`** | Primary body text, headings, form labels, and text inside `#fadadd` and `#ffffff` containers (Charcoal Black). | Contrast ratio > 14:1 on `#ffffff` and > 11:1 on `#fadadd` (WCAG AAA). |
| `--color-text-muted` | **`#52525b`** | Secondary helper text, timestamps, and metadata captions. | Contrast ratio > 7:1 on `#ffffff`. |
| `--color-accent-action` | **`#1a1a1a`** | Primary submit CTA buttons (`#1a1a1a` fill with `#ffffff` text, or `#fadadd` fill with `#1a1a1a` text and `2px solid #1a1a1a` border). | High-visibility primary action affordance. |
| `--color-error` | **`#dc2626`** | Validation error messages, invalid field borders, duplicate submission alerts, and HTTP 403/422 banners (Crimson Red). | Paired with `#fef2f2` light red alert background. |
| `--color-success` | **`#16a34a`** | Submission confirmation banners, passing status badges (`PUBLISHED`), and toast notifications (Emerald Green). | Paired with `#f0fdf4` light green alert background. |
| `--color-warning` | **`#d97706`** | Closed campaign badges (`CLOSED`) and deadline warnings (Amber). | Paired with `#fffbeb` light amber background. |

### 3.2 Navigation & Shared UI Behavior
- **Main Screens:**
  1. `/login`: Centered white card (`#ffffff`) on `#fdf6f7` background with `#fadadd` header accent; email/password form and inline red error banner (`#dc2626`).
  2. `/campaigns`: Role-adaptive dashboard. Displays white tab navigation (`All Open Surveys` / `My Campaigns` / `+ Create Campaign`) highlighted with `#fadadd` active tab indicators.
  3. `/campaigns/new` (`CREATOR` only): Form builder to add campaign metadata and dynamic rating/text questions.
  4. `/campaigns/:id/respond` (`RESPONDENT` view): Clean white survey card displaying 1–5 star interactive buttons and text inputs. Under proposed FR-11/BR-06, an existing respondent can edit their saved answers while the campaign remains open.
  5. `/campaigns/:id/results` (`CREATOR` owner view): Summary KPI cards (Total Responses, Average Rating) and itemized feedback table on white surfaces.
- **Mandatory UI States:**
  - **Validation State:** Inline `#dc2626` error text directly beneath invalid fields plus a top alert summary when API returns `400`, `409`, or `422`.
  - **Loading State:** Disabled submit buttons with `"Submitting..."` label and skeleton/spinner placeholders while fetching API data.
  - **Empty State:** Structured white card with clear guidance (e.g., `"No feedback submissions received yet."`).
  - **Error State:** Recoverable error banner (`#dc2626`) with a `"Retry"` action if network or server failure occurs.

---

## 4. API Conventions & Security Architecture

### 4.1 REST API Conventions
- Base path: `/api`
- Content-Type: `application/json`
- Standard Success Envelope: `{ "data": <payload> }`
- Standard Error Envelope (no stack traces leaked):
  `{ "error": { "code": "ERROR_CODE", "message": "Human-readable explanation", "details": [] } }`
- Standard HTTP Status Codes: `200 OK` (successful response revision), `201 Created` (first submission), `400 Bad Request` (validation), `401 Unauthorized` (unauthenticated), `403 Forbidden` (role/ownership denied), `404 Not Found`, `409 Conflict` (concurrent submission write conflict), `422 Unprocessable Entity` (closed campaign rule).

### 4.2 Role & Ownership Permission Matrix (`BR-04`)
| Operation / Endpoint | Unauthenticated | `RESPONDENT` | `CREATOR` (Non-Owner) | `CREATOR` (Owner) |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/auth/login` | Allowed | Allowed | Allowed | Allowed |
| `POST /api/auth/logout` | `401` | Allowed | Allowed | Allowed |
| `GET /api/auth/me` | `401` | Allowed (self) | Allowed (self) | Allowed (self) |
| `GET /api/campaigns` | `401` | Allowed (`PUBLISHED` only) | Allowed (own campaigns) | Allowed (own campaigns) |
| `POST /api/campaigns` | `401` | `403 Forbidden` | Allowed | Allowed |
| `GET /api/campaigns/:id` | `401` | Allowed (if `PUBLISHED`) | `403 Forbidden` | Allowed |
| `POST /api/campaigns/:id/submissions` | `401` | Allowed to submit or revise own response if `PUBLISHED` and open (proposed BR-06) | `403 Forbidden` | `403 Forbidden` |
| `GET /api/campaigns/:id/results` | `401` | `403 Forbidden` | `403 Forbidden` | Allowed |

### 4.3 Authentication & Session Lifecycle
- **Login (`POST /api/auth/login`):** Looks up user by email, verifies password via `bcrypt.compare(plain, passwordHash)`. On success, signs a JWT (`{ userId, role }`, expiry `24h`) with `SESSION_SECRET` and sets cookie `pastelpulse_session` (`HttpOnly=true`, `SameSite=Lax`, `Secure` in production).
- **Current User (`GET /api/auth/me`):** Middleware verifies JWT signature and expiry, queries current user record from PostgreSQL, and attaches `req.user`.
- **Logout (`POST /api/auth/logout`):** Clears `pastelpulse_session` cookie (`Max-Age=0`) and returns `200 OK`. Subsequent requests to protected endpoints immediately receive `401 Unauthorized`.

### 4.4 Submission Revision (Proposed Lab 7 Amendment)

- The existing `POST /api/campaigns/:id/submissions` endpoint remains the only
  submission endpoint. The authenticated identity supplies `respondentId`;
  clients cannot select another respondent's submission.
- The API checks authentication, `RESPONDENT` role, campaign existence and
  openness, payload shape, question membership, and current answer validation
  before changing stored data.
- For a first valid response, behavior remains `201 Created`. For a valid
  response when the respondent already has one, the API atomically updates that
  submission's `submittedAt`, replaces its answer rows, retains its submission
  ID, and returns `200 OK` with `updated: true`.
- A failed validation or failed transaction leaves the previous response
  unchanged. A closed/expired campaign remains rejected by BR-02. The unique
  `(campaignId, respondentId)` constraint remains in place.
- The respondent details endpoint already returns `hasSubmitted` and
  `mySubmission`; the client must use that saved data to initialize an editable
  form rather than permanently presenting it as read-only. Creator result
  access and ownership checks are unchanged; results show the latest saved
  answer set.
- This amendment has no schema migration requirement. Historical submissions
  are not backfilled; each future revision overwrites that respondent's prior
  answer set and timestamp, with no revision audit history.

---

## 5. Configuration & Lab 5 GCP Deployment Readiness (`NFR-05`)
- **Environment Variables:** Configured strictly via `process.env` and documented in `.env.example` (real `.env` is gitignored):
  - `PORT` (default `4000`)
  - `DATABASE_URL` (PostgreSQL connection string)
  - `SESSION_SECRET` (JWT signing secret)
  - `CLIENT_ORIGIN` (Allowed CORS origin, e.g., `http://localhost:5173`)
  - `NODE_ENV` (`development` | `test` | `production`)
- **Health & Readiness Endpoints:**
  - `GET /api/health` -> returns `200 OK` `{ "status": "ok" }`
  - `GET /api/ready` -> executes `SELECT 1` via Prisma; returns `200 OK` `{ "status": "ready", "database": "connected" }` or `503 Service Unavailable` if DB is unreachable.
- **Container & Cloud Run Compatibility (Lab 5 Plan):**
  - Stateless backend with PostgreSQL persistence (maps cleanly to **Cloud Run** + **Cloud SQL for PostgreSQL** + **Secret Manager** in Lab 5).
  - Single-origin or reverse-proxy Nginx routing ready for Docker multi-stage builds.