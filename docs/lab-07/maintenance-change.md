# Lab 7 Maintenance Change

## Selected change

**Allow a respondent to revise their one saved response while a campaign is
open.** A later valid submission replaces the answer set on the existing
submission record; it does not create another record.

**Status:** Teammate-approved in PR #37; not implemented.

## Repository evidence and baseline

- The accepted Sprint 1 requirements were introduced in `6de1b60`
  (`spec: add baseline SRS, SDS, and Sprint 1 contracts`).
- Sprint 1 implementation commit `64f3591aceed509714bcaf6df6dcf6e2e93daaa1`
  implemented authentication, campaigns, submission, and creator results.
  Sprint 1 was merged to `main` by `bb3262914ad77f4692d21444dd5269efad368d89`
  (PR #5), which contains the feature implementation from PR #4.
- There is no Git tag for the Sprint 1 baseline.
- **Actual pre-change tree:** `2e4dd235aa152e68d584d23018f3fb037efa5930`
  (`HEAD`, `feature/lab7-Maintenance-Change`) immediately before this
  documentation amendment. The application behavior is the same as in its
  parent `d6b2fbb`; intervening PR #31 changed documentation and
  `client/index.html`, not the submission implementation.
- No application source or automated test code is changed by this Lab 7
  contract work.

### Verified Sprint 1 behavior

Sprint 1 `FR-05`, `BR-01`, F-03, AC-08, and TEST-08 define and verify one
submission per respondent/campaign: the first valid submission is persisted;
a second request receives `409 Conflict` (`DUPLICATE_SUBMISSION`), and the
database still contains one submission. This was correctly implemented in the
accepted Sprint 1 baseline, not a feature gap.

The current implementation retains that behavior in
[campaigns.ts](../../server/src/routes/campaigns.ts), with the corresponding
unique constraint in [schema.prisma](../../server/prisma/schema.prisma) and
integration test in
[sprint1.test.ts](../../server/src/test/sprint1.test.ts). The respondent UI in
[RespondPage.tsx](../../client/src/pages/RespondPage.tsx) displays the previous
answers as read-only after submission. The current Sprint 1 API contract and
test specification record the original result in
[contracts.md](../sprints/sprint-1/contracts.md) and
[sts-dod.md](../sprints/sprint-1/sts-dod.md).

The existing [formFeatures.test.ts](../../server/src/test/formFeatures.test.ts)
also verifies that the respondent details API returns `hasSubmitted` and
`mySubmission` after submission. No `RespondPage` or `FormRenderer` automated
component/E2E test file is present in the inspected repository; TEST-12 is
specified in the STS, so the new response-revision API/DB tests are the
immediate automated verification target.

## Candidate comparison

| Candidate | Original behavior → proposed behavior | Reason / affected features | Complexity / testability | Main regression risks |
|---|---|---|---|---|
| **A. Revise the existing response in place (selected)** | A repeat valid submission is rejected with 409 → while the campaign is open, it replaces the respondent's saved answers on the existing row. | Lets a respondent correct a mistake without inflating campaign response counts. F-03 / FR-05, new FR-11, BR-01 and new BR-06; F-04 results continue to show one latest response. | **Medium.** Transactional answer replacement, UI answer hydration, and a few API/DB integration cases. No new table or subsystem; automated tests can assert status, row count, ID, timestamp, and exact saved answers. | Partial answer replacement, stale answers, accidental duplicate rows, outdated result aggregates, or allowing edits after close. |
| **B. Store every repeat submission as a separate response** | A repeat is rejected → each repeat creates a new submission record and independent answer set. | Would provide response history but changes response counts and the existing one-record data model. Affects F-03, F-04 and analytics. | **High.** Requires removing the unique constraint and reviewing analytics, client history, and historical-data interpretation. API/DB tests are possible. | Inflated counts, changed averages, ambiguous respondent history, and migration/rollback risk. |
| **C. Permit exactly one correction** | A repeat is rejected → one revision is allowed, then further attempts are rejected. | Limits repeated changes but does not have a documented Sprint 1 precedent; requires tracking whether the correction was used. Affects F-03 and persistence. | **Medium–high.** Requires a persisted revision counter/flag or equivalent and tests for first correction and next rejection. | State inconsistency, additional migration, and a surprising arbitrary limit. |

### Recommendation and reason

Select Candidate A. It makes the smallest meaningful change to the already
implemented Sprint 1 submission rule: the unique one-row invariant stays, while
the second-valid-request outcome changes. It avoids new version-history or
revision-limit state and has direct automated verification points.

The proposed product rationale is to let a respondent correct an accidental
answer while the campaign still accepts responses, without increasing the
campaign's submission count. This is the rationale for the proposal, not a
claim of recorded stakeholder feedback.

## Contract change

The change is specified as **FR-11** and **BR-06**. The baseline wording of
BR-01 and its Sprint 1 behavior are preserved in the requirement history; the
amendment retains one persisted row and changes the duplicate-rejection
outcome.

The full interface, boundaries, invalid cases, authorization, Given/When/Then
criteria, and planned tests are in
[engineering-contract.md](./engineering-contract.md). The component-by-
component impact and traceability matrix are in
[impact-analysis.md](./impact-analysis.md).

The repository contains a feature inventory (`docs/features.md`) and a
system-level SDS (`docs/system-sds.md`), but no separate feature-level SDS
file. Those actual artifacts are updated instead of creating a fictitious
document path.

## Review status

A second-member checklist is prepared in
[impact-analysis.md](./impact-analysis.md). PR #37 was approved by
`Khanatip112` (GitHub ID `121042521`) on head commit
`bbf59890b5e6fcd85b062453f9dae4ae505a6ad2`; the reviewed diff includes this
maintenance change and engineering contract. The review said, “Everything look
goog JK u can merge.” There were no inline review threads. No instructor/TA
approval gate is added.
