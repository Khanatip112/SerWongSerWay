# Lab 7 Engineering Contract — Revise an Existing Response

**Status:** Teammate-approved in PR #37 before implementation; Issue #2 implementation completed.
**Requirement IDs:** FR-11, BR-06.  
**Affected baseline behavior:** FR-05 / BR-01 in F-03, AC-08 / TEST-08.

## 1. Baseline identity and history

- **Accepted Sprint 1 implementation:** `64f3591aceed509714bcaf6df6dcf6e2e93daaa1`,
  merged to `main` by `bb3262914ad77f4692d21444dd5269efad368d89` (PR #5).
- **Accepted Sprint 1 requirement baseline:** `6de1b60`; no Git tag exists for
  this baseline.
- **Actual pre-change tree:** `2e4dd235aa152e68d584d23018f3fb037efa5930`
  (`HEAD`) immediately before this contract amendment.
- **Original requirement (BR-01):** “A `RESPONDENT` cannot submit more than
  one response to the same campaign. Any duplicate submission attempt must be
  rejected with HTTP `409 Conflict` without creating a second record.”
- **Original implemented behavior:** First valid POST creates a submission;
  a repeat POST returns `409 DUPLICATE_SUBMISSION`. The database has
  `@@unique([campaignId, respondentId])`. TEST-08 verifies that the count
  remains exactly one. This was correctly implemented Sprint 1 behavior.

This contract retains the one-record invariant and preserves the original
BR-01/AC-08/TEST-08 result as Sprint 1 history. FR-11/BR-06 intentionally
change the repeat-request behavior.

## 2. New requirement

### FR-11 — Revise Existing Feedback Submission

An authenticated `RESPONDENT` can revise their existing answer set for a
`PUBLISHED` campaign while it remains open. A successful revision replaces the
stored answers on the existing submission, retains the submission ID, updates
`submittedAt` to the latest successful submit time, and does not create another
submission record.

### BR-06 — Revise Existing Submission While Open

For an authenticated respondent and campaign:

1. If no submission exists, preserve Sprint 1 behavior: validate and create
   one submission, returning `201 Created`.
2. If a submission already exists and the campaign is `PUBLISHED` and not past
   its deadline, validate the entire new answer payload before mutation. If
   valid, atomically replace all persisted answers for that submission, retain
   its ID, set `submittedAt` to current server UTC time, and return `200 OK`
   with `updated: true`.
3. The unique `(campaignId, respondentId)` constraint remains. Repeated valid
   revisions may occur while the campaign remains open; each replaces the
   prior answer set. No answer-version history is retained.
4. An invalid replacement or failed transaction must leave the last committed
   submission and answers unchanged.
5. This rule supersedes only BR-01's “reject every duplicate request” outcome.
   The one-row-per-respondent/campaign invariant remains in force.

### Reason for change

Permit respondents to correct an accidental answer while a campaign is still
accepting responses, without increasing its response count. This is the
proposal's rationale; it is not represented as stakeholder feedback.

## 3. Scope

### In scope

- Same authenticated `RESPONDENT` revises their existing answers using
  `POST /api/campaigns/:id/submissions`.
- Existing answer validation, question membership, and conditional-section
  rules apply to the replacement payload.
- Answer replacement and `submittedAt` update are atomic.
- The respondent UI can edit a prefilled saved response while the campaign is
  open and receives an update-success state.
- Creator results continue to show one response per respondent, using the
  latest saved answers.

### Out of scope

- Multiple submission records per respondent/campaign.
- Revision history, audit log, or recovery of overwritten answers.
- A limit on the number of revisions while the campaign remains open.
- Editing campaign questions or bypassing the existing BR-05 question lock.
- Changes to login, roles, creator ownership, campaign lifecycle, or rating
  and required-answer rules.
- New routes, tables, external services, or data migration.
- Any implementation or automated test execution as part of this contract task.

## 4. Interface and processing contract

### Endpoint and input

`POST /api/campaigns/:id/submissions` remains respondent-only. The request
shape remains:

```json
{
  "answers": [
    { "questionId": "question-uuid", "ratingValue": 4 },
    { "questionId": "text-question-uuid", "textValue": "Updated comment" }
  ]
}
```

`respondentId` is obtained only from the authenticated session and is not
accepted from the request body.

### Preconditions

- The caller has a valid authenticated session and role `RESPONDENT`.
- The campaign exists and is `PUBLISHED`.
- If `closesAt` is set, current server UTC time is strictly earlier than it.
- The submitted answer payload refers only to questions in that campaign and
  satisfies the existing required-answer and type-specific validation.

### Expected results

| Situation | HTTP result | Persistence |
|---|---|---|
| First valid submission | `201 Created`, existing response envelope | Create one submission and its answers. |
| Valid revision by same respondent while open | `200 OK`, `{ data: { submissionId, campaignId, submittedAt, updated: true } }` | Keep submission ID and row count; replace answer set and update `submittedAt` atomically. |
| Valid revision submitted again while still open | `200 OK`, `updated: true` | Replace prior revision again; still exactly one row. |

### Preconditions, boundaries, and invalid cases

- At exactly `closesAt`, and after it, a revision is not allowed; return
  `422 Unprocessable Entity` with `CAMPAIGN_NOT_OPEN`.
- A `DRAFT` or `CLOSED` campaign returns `422` and changes no saved data.
- Missing campaign returns `404`; no saved data changes.
- Malformed payload, unknown question, missing required answer, or invalid
  rating returns `400`; the existing saved answers and timestamp remain
  unchanged.
- Missing/invalid authentication returns `401`.
- Authenticated `CREATOR` or any non-`RESPONDENT` returns `403`.
- A respondent cannot revise another respondent's answer because the target
  record is selected using the authenticated user's ID.
- A concurrent database conflict must not create another row or leave a
  partially replaced answer set. The implementation may return a conflict for
  a racing request; the sequential valid-revision behavior above remains
  `200 OK`.

## 5. Acceptance Criteria

### AC-13 — Valid in-place response revision

- **Given** a `RESPONDENT` has one saved submission to an open `PUBLISHED`
  campaign
- **When** they send a different valid answer set to the existing submissions
  endpoint
- **Then** the endpoint returns `200 OK` with `updated: true`, the same
  `submissionId`, and a `submittedAt` timestamp corresponding to the latest
  successful request; PostgreSQL contains exactly one submission for the
  campaign/respondent pair and its complete answer set matches the replacement
  payload, with no stale answers.

### AC-14 — Invalid, closed, and unauthorized revisions do not mutate data

- **Given** a respondent has an existing submission
- **When** they send an invalid answer set, or attempt revision when the
  campaign is closed/expired
- **Then** the API returns `400` for invalid answers or `422
  CAMPAIGN_NOT_OPEN` for a closed/expired campaign, and the persisted answers,
  timestamp, submission ID, and row count remain unchanged.
- **Given** an unauthenticated caller or an authenticated `CREATOR`
- **When** they call the submission endpoint
- **Then** the API returns `401` or `403`, respectively, and reveals or changes
  no submission data.

## 6. Software Test Specification additions

The specifications below define the test coverage; actual RED, GREEN, and
regression outcomes are recorded in
[RED evidence](./evidence/red-test.md),
[GREEN evidence](./evidence/green-test.md), and
[the regression report](./evidence/regression-report.md).

| Test ID | AC | Level | Preconditions and action | Expected result |
|---|---|---|---|---|
| TEST-13 | AC-13 | API / PostgreSQL integration | As a seeded respondent, submit valid answers to an open campaign, then submit a different valid set to the same campaign. Query submission and answers after each call. | First response is `201`; revision is `200` with `updated: true` and same submission ID. Exactly one row exists; timestamp reflects the later request; persisted answers exactly match the latest payload. |
| TEST-14 | AC-14 | API / PostgreSQL integration | Create an initial valid response; attempt an invalid replacement, then a replacement after closing/expiring the campaign. Also call as anonymous and as a Creator. | Invalid is `400`, closed/expired is `422`, anonymous is `401`, Creator is `403`. Each rejected update leaves the original ID, timestamp, count, and answers unchanged. |

The baseline TEST-08 duplicate rejection remains documented as historical
Sprint 1 evidence; it is superseded for current revision semantics by TEST-13
and TEST-14. Existing TEST-07, TEST-09, TEST-10, and TEST-11 remain regression
coverage for first-submit persistence, open status/validation, and creator
results ownership.

## 7. Contract change record

| Revision | Change | Status |
|---|---|---|
| Sprint 1 baseline | BR-01 rejected all duplicate submissions; TEST-08 verified `409` and one stored row. | Accepted historical behavior. |
| Lab 7 proposal | Add FR-11/BR-06: revise existing answers in place while open; keep one row, preserve original baseline wording in history. | Teammate-approved in PR #37 before implementation. |
| Issue #2 implementation | Validate revisions before atomically replacing answers and updating `submittedAt`; prefill the respondent form for open campaigns. | Implemented; TEST-13/TEST-14 GREEN and regression evidence recorded. |

No instructor/TA approval requirement is added. The second-member contract
review is recorded in PR #37; implementation may proceed under this reviewed
contract.
