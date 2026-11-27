# Lab 7 Impact Analysis — Response Revision

## Scope and baseline

This analysis covers the proposed FR-11 / BR-06 change to the existing Sprint 1
F-03 submission behavior. It changes what a second valid respondent submission
does while a campaign remains open. It preserves one submission row per
respondent/campaign and does not create a response-history subsystem.

**Accepted Sprint 1 baseline:** `bb3262914ad77f4692d21444dd5269efad368d89`
(PR #5 merge to `main`), containing Sprint 1 implementation
`64f3591aceed509714bcaf6df6dcf6e2e93daaa1`. The baseline requirements were
committed at `6de1b60`. No Sprint 1 tag exists.

**Actual pre-change tree:** `2e4dd235aa152e68d584d23018f3fb037efa5930`
(`HEAD`) immediately before this documentation change. PR #31 since
`d6b2fbb` did not alter the submission route, Prisma schema, or submission
tests.

## Impact by area

| Area | Impact |
|---|---|
| **Frontend / UI** | `RespondPage.tsx` currently renders `mySubmission` read-only and shows a duplicate-submission error. Change the open-campaign state to an editable form prepopulated from `mySubmission`; show the existing answers and latest submission timestamp, and show an update-success message after `200 OK`. `FormRenderer.tsx` currently owns its answer state and has no initial-answer input, so it will need a small initialization path. Keep the read-only/closed behavior for campaigns that are not open. |
| **Backend / API** | Keep `POST /api/campaigns/:id/submissions`. After auth, open-campaign checks, and payload validation, create on first submission (existing `201`) or transactionally replace answer rows on a later valid submission (`200`, same ID, `updated: true`). Validate before mutation. Failed validation or transaction must not partially replace the saved answers. |
| **Business logic** | Replace the early duplicate `409` branch with create-or-revise behavior. Reuse existing BR-02 campaign-open and BR-03 answer validation. The accepted answer set must obey current question membership and conditional-section validation. |
| **Database and persistence** | Keep `@@unique([campaignId, respondentId])`; update the existing `Submission`, replace its `Answer` rows, and set `submittedAt` to the latest successful revision time in one transaction. This preserves one row and allows concurrent first-create races to remain protected by the unique constraint. Concurrent updates must not leave a mixed or partial answer set; a conflicting race may be rejected with a conflict response and retried by the user. |
| **Authentication** | No authentication mechanism change. Missing/invalid session remains `401`; identity comes from the authenticated request, not a respondent ID supplied in the body. |
| **Authorization and ownership** | Only `RESPONDENT` may submit or revise. A creator still receives `403` on this endpoint. A respondent can only revise their own row because lookup/update is keyed by the authenticated user and campaign. Creator results remain restricted by existing BR-04 ownership guard. |
| **Historical data** | Existing rows and answers are not migrated. A successful future revision overwrites that respondent's prior answer set and `submittedAt`; no prior version/audit trail is retained. The creator results view consequently reports the latest answers while counting one response. This intentional loss of the previous answer version is called out in the contract. |
| **Database migration** | Not applicable: the existing schema already has a unique compound key and cascading `Answer` relation suitable for an in-place replacement. No new persistence field or table is proposed. |
| **Dependencies and callers** | The respondent form calls the existing POST route. `GET /api/campaigns/:id` already returns `hasSubmitted` and `mySubmission`; the client needs to use this data to seed the editable form. The creator results endpoint reads submission answers and should naturally return the latest persisted set. No route or external service is added. |
| **Regression behavior** | First submissions still return `201`; one row per respondent/campaign remains; invalid answers stay `400`; `DRAFT`, `CLOSED`, and expired campaigns remain `422`; authentication and role guards remain; respondent isolation and creator ownership remain; result counts remain one per respondent/campaign. |

## Traceability

| Requirement ID | Feature | SRS | SDS | AC | STS / Test ID | Code Module | Impact |
|---|---|---|---|---|---|---|---|
| FR-05 (baseline) | F-03 | Existing FR-05 | System SDS §1.2, §4.2 | AC-07 | TEST-07 | `server/src/routes/campaigns.ts`; `client/src/pages/RespondPage.tsx` | First valid submission remains create-and-persist (`201`). |
| BR-01 (baseline invariant) | F-03 | BR-01; original wording preserved in SRS §8 | System SDS §2.2 | AC-08 (historical) | TEST-08 (historical) | `server/prisma/schema.prisma`; `server/src/routes/campaigns.ts` | The old rejection outcome is replaced; unique one-row invariant is retained. |
| BR-02 | F-03 | BR-02 | System SDS §4.2, §4.4 | AC-09, AC-14 | TEST-09, TEST-14 | `server/src/routes/campaigns.ts` | Existing published/open requirement still gates first submissions and revisions. |
| BR-03 | F-03 | BR-03 | System SDS §1.2, §4.4 | AC-14 | TEST-14 | `server/src/utils/validation.ts`; `server/src/routes/campaigns.ts` | Existing validation applies before either create or replacement. |
| FR-11 (proposed) | F-03 | New FR-11 | System SDS §3.2, §4.4 | AC-13, AC-14 | TEST-13, TEST-14 | `client/src/pages/RespondPage.tsx`; `client/src/components/FormRenderer.tsx`; `server/src/routes/campaigns.ts` | Enables editing and replacing own saved answers while open. |
| BR-06 (proposed) | F-03 | New BR-06 | System SDS §1.2, §2.2, §4.4 | AC-13, AC-14 | TEST-13, TEST-14 | `server/src/routes/campaigns.ts`; `server/prisma/schema.prisma` (existing constraint retained) | Requires atomic answer replacement, stable submission ID, latest timestamp, and no extra row. |
| NFR-03 | F-03 / persistence | Existing NFR-03 | System SDS §1.2, §2.2 | AC-13, AC-14 | TEST-13, TEST-14 | Prisma transaction in `server/src/routes/campaigns.ts` | Confirms update durability and no partial answer replacement. |
| BR-04 (no change) | F-04 | Existing BR-04 | System SDS §1.2, §4.2 | AC-11 | TEST-11 | Results route in `server/src/routes/campaigns.ts` | Not applicable to revising a respondent's own response; result ownership guard remains unchanged and is regression-tested. |

## Regression risks and controls

1. **Old answers remain after revision.** Require TEST-13 to compare the
   complete persisted answer set with the replacement payload, not merely
   check that the new value appears.
2. **Partial data after validation or transaction failure.** TEST-14 compares
   saved answers and timestamp before and after a rejected update; implementation
   must use one transaction.
3. **Duplicate rows under concurrent first requests.** Retain the database
   unique constraint; verify a concurrency case if the implementation uses
   separate read-then-create logic.
4. **Updates after deadline or closure.** Reuse the existing BR-02 guard and
   verify rejected revisions leave the stored response unchanged.
5. **Incorrect identity/ownership.** Do not accept `respondentId` from request
   payload. Preserve role middleware and results-owner checks.
6. **Changed analytics.** Creator results should still count one submission and
   recompute rating averages from the latest answers.
7. **UI form state mismatch.** Load prior answers into the live form and test
   that revision does not render the read-only state while the campaign is
   open.

## Second-member review checklist

Reviewer: **Khanatip112** (GitHub ID `121042521`), distinct from PR author
`JKNIGHTSX` (GitHub ID `179080988`)
Review status: **Approved in PR #37** on commit
`bbf59890b5e6fcd85b062453f9dae4ae505a6ad2`, before implementation. The PR
diff includes the maintenance-change, impact-analysis, and engineering-contract
documents.

- [ ] Confirm the old and new behavior match the accepted Sprint 1 evidence.
- [ ] Confirm impact analysis covers frontend, API, business logic, persistence,
      authentication, authorization, historical data, migration, dependencies,
      and regression behavior.
- [ ] Review AC-13/AC-14 for measurable boundary and invalid-input behavior.
- [ ] Confirm TEST-13/TEST-14 can verify the response and persisted state.
- [ ] Identify any additional race, privacy, or regression risk.
- [ ] Record reviewer name, date, and actual comments below; do not mark
      approved without the reviewer's explicit decision.

### Actual review feedback

Formal review: **APPROVED**. Actual reviewer text: “Everything look goog JK u
can merge.” The reviewer also left no inline review threads. This is the full
feedback available; no detailed checklist-specific comments are attributed to
the reviewer. A separate PR comment by the author said “Thank na kub na.” No
additional reviewer feedback is recorded.
