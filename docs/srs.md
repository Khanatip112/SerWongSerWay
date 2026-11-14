# Software Requirements Specification (SRS)
## Project: Review, Feedback, and Survey System (PastelPulse)
- **Course:** CPE 334 Introduction to Software Engineering in the Age of AI Agents (Semester 1/2026)
- **Version:** 1.0 (Engineering Baseline)
- **Status:** Approved for Sprint 1 Implementation

---

## 1. Stakeholder Problem & Context
Organizations, event organizers, and academic clubs frequently collect structured surveys and open-ended reviews from participants. Existing ad-hoc tools either lack strict ownership boundaries (allowing unauthorized users to alter or inspect private feedback results) or fail to enforce domain integrity rules such as duplicate-submission prevention and closing deadlines.

**PastelPulse** is a web-based Review, Feedback, and Survey System designed to let authorized Creators publish structured feedback forms and rating campaigns, while enabling Respondents to submit verified responses under strict business-rule and access-control enforcement.

---

## 2. Actors & Responsibilities
| Actor | Description | Primary Responsibilities |
| :--- | :--- | :--- |
| **Creator** | Authenticated campaign owner (e.g., organizer, instructor, product owner). | Create, configure, publish, and close surveys/review campaigns; view aggregated ratings and individual feedback submissions strictly for campaigns they own. |
| **Respondent** | Authenticated participant or customer. | Browse active/published campaigns; submit ratings and structured feedback responses; view their own past submissions. |
| **Unauthenticated Visitor** | Anonymous user without an active session. | Access the login page and public health/readiness endpoints only; cannot access protected campaign data or submit feedback. |

---

## 3. Product Scope & Explicit Exclusions

### 3.1 In-Scope (Full Product Baseline)
- Credential-based authentication (login, logout, current-user identity resolution) using seeded accounts.
- Role-based access control (RBAC) and record-level ownership enforcement on the backend API.
- Creation and lifecycle management (`DRAFT`, `PUBLISHED`, `CLOSED`) of Review & Survey campaigns.
- Support for structured questions (1–5 star rating, single-choice, and open-ended text feedback).
- Submission of responses with strict duplicate prevention and status/deadline validation.
- Creator analytics dashboard showing response counts, average ratings, and individual feedback entries.

### 3.2 Explicit Exclusions (Out of Scope)
- Self-service user registration, email verification, and password-recovery flows (seeded test accounts are used).
- OAuth / third-party social login (e.g., Google/GitHub SSO).
- File/image attachments inside survey responses.
- Payment processing, monetary rewards, or external email/SMS notification dispatchers.
- Multi-tenant organization hierarchies beyond individual Creator ownership.

---

## 4. Functional Requirements (FR)
| ID | Requirement Title | Observable System Behavior | Target Sprint |
| :--- | :--- | :--- | :--- |
| **FR-01** | User Authentication & Identity | Users can log in with valid email and password credentials, establish an authenticated session, retrieve their current user profile and role (`CREATOR` or `RESPONDENT`), and log out to invalidate the session. | Sprint 1 |
| **FR-02** | Create Review/Survey Campaign | An authenticated `CREATOR` can create a new campaign with a title, description, closing timestamp, and a list of questions (rating scale 1–5 and/or text prompt), initially saved or published. | Sprint 1 |
| **FR-03** | Publish & Close Campaign Lifecycle | A `CREATOR` can transition their own campaign from `DRAFT` to `PUBLISHED` (making it visible to `RESPONDENT` users) and from `PUBLISHED` to `CLOSED` (halting new submissions). | Sprint 2 |
| **FR-04** | Browse Available Campaigns | An authenticated `RESPONDENT` can list all `PUBLISHED` campaigns and view campaign details and questions before submitting. A `CREATOR` can list all campaigns they own regardless of status. | Sprint 1 |
| **FR-05** | Submit Feedback / Survey Response | An authenticated `RESPONDENT` can submit answers to a `PUBLISHED` campaign, persisting the rating and text feedback linked to the respondent's user ID and campaign ID. | Sprint 1 |
| **FR-06** | View Persisted Campaign Results | An authenticated `CREATOR` can retrieve all submitted responses and summary statistics (total submissions and average numeric rating) for a campaign they own. | Sprint 1 |
| **FR-07** | View Personal Submission History | An authenticated `RESPONDENT` can view a list of their own previously submitted feedback responses and ratings. | Sprint 2 |
| **FR-08** | Edit Draft Campaign | A `CREATOR` can update the title, description, or questions of their own campaign while its status is `DRAFT`. | Sprint 2 |
| **FR-09** | Filter & Search Feedback Results | A `CREATOR` can filter submissions on their campaign by rating score (e.g., 1–5 stars) or keyword search within text comments. | Sprint 3 |
| **FR-10** | Export Campaign Summary (CSV) | A `CREATOR` can export the responses of their owned campaign as a downloadable CSV report. | Sprint 3 |

---

## 5. Business Rules (BR)
| ID | Rule Name | Domain Constraint & Rejection Behavior | Target Sprint |
| :--- | :--- | :--- | :--- |
| **BR-01** | One Submission Per Respondent Per Campaign | A `RESPONDENT` cannot submit more than one response to the same campaign. Any duplicate submission attempt must be rejected with HTTP `409 Conflict` without creating a second record. | Sprint 1 |
| **BR-02** | Campaign Must Be Open (`PUBLISHED`) to Accept Responses | Submissions are accepted only when the target campaign status is `PUBLISHED` and the current server UTC time is strictly earlier than `closesAt` (if set). Attempts to submit to `DRAFT` or `CLOSED` campaigns must be rejected with HTTP `422 Unprocessable Entity`. | Sprint 1 |
| **BR-03** | Valid Rating Scale & Required Fields | Every rating answer must be an integer between `1` and `5` inclusive, and every required question must have a non-empty answer. Invalid payloads must be rejected with HTTP `400 Bad Request`. | Sprint 1 |
| **BR-04** | Strict Creator Ownership on Results & Mutations | Only the `CREATOR` whose `userId` matches `campaign.creatorId` may view detailed campaign submissions, update the campaign, or close it. Requests from any other `CREATOR` or `RESPONDENT` must be rejected with HTTP `403 Forbidden`. | Sprint 1 |
| **BR-05** | Immutable Questions After First Submission | Once a campaign has at least one recorded submission, its question definitions cannot be modified or deleted, preserving historical answer integrity (HTTP `409 Conflict`). | Sprint 2 |

---

## 6. Non-Functional Requirements (NFR)
| ID | Category | Measurable Target | Practical Verification Method | Target Sprint |
| :--- | :--- | :--- | :--- | :--- |
| **NFR-01** | Authentication Enforcement | 100% of protected API endpoints reject unauthenticated requests with HTTP `401 Unauthorized` and return zero private records. | Automated API integration tests sending requests without a session cookie/token. | Sprint 1 |
| **NFR-02** | Password & Secret Security | Passwords are never stored or logged in plaintext; stored hashes use `bcrypt` (cost factor >= 10), and zero secrets exist in Git-tracked files. | Database inspection / unit test on password hashing utility and repository secret scan. | Sprint 1 |
| **NFR-03** | Data Persistence & Integrity | Committed campaign and response records survive application server restarts and maintain referential integrity via foreign keys and unique constraints. | Automated API + PostgreSQL integration tests verifying database state across requests. | Sprint 1 |
| **NFR-04** | Consistent Visual & Accessibility Contrast | All UI screens apply the Pastel Pink (`#fadadd`) theme specification with a minimum text contrast ratio of 7:1 (`#1a1a1a` on `#ffffff` / `#fadadd`) and clear semantic states. | Component/E2E UI inspection and automated DOM/style assertions. | Sprint 1 |
| **NFR-05** | Cloud-Ready Statelessness | Application reads all configuration (`PORT`, `DATABASE_URL`, `SESSION_SECRET`) from environment variables and exposes `GET /api/ready` checking live DB connectivity. | Automated API integration test against `/api/ready` and `.env.example` verification. | Sprint 1 |

---

## 7. Assumptions & Design Decisions
1. **Seeded Accounts Strategy:** Per Deliverable 1 guidelines, deterministic seed scripts create test `CREATOR` and `RESPONDENT` accounts so local grading and automated tests run reproducibly without manual sign-up.
2. **Database-Backed / Stateless JWT HttpOnly Cookie Auth:** Authentication uses signed JWTs stored in `HttpOnly`, `SameSite=Lax` cookies. This avoids in-memory server session storage, ensuring seamless horizontal scaling and container restarts on Google Cloud Run in Lab 5.
3. **Database-Level Uniqueness:** In addition to application-layer checks, `BR-01` is enforced at the PostgreSQL schema level via a composite unique constraint `@@unique([campaignId, respondentId])` on the `Submission` table to prevent race-condition duplicates.
4. **Pastel Pink UI Theme:** User preference specifies `#fadadd` (Pastel Pink) as the primary brand accent, paired with high-contrast `#1a1a1a` (charcoal black) typography, `#ffffff` (pure white) surfaces/cards/tabs, `#dc2626` (crimson red) error states, and `#16a34a` (emerald green) success states.