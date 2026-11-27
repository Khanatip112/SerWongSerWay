# CPE 334 Lab 7 — Maintenance Change Proposal

## Decision record

**Selected change:** Restore optional closing deadlines when publishing a campaign.

This is the team's proposed Lab 7 maintenance change. It is limited to Sprint 1
campaign creation and submission behavior; implementation is not part of this
proposal. Instructor/TA approval is not a prerequisite.

## Baseline and change point

- **Accepted Sprint 1 baseline:** The Sprint 1 implementation was merged to
  `main` by merge commit `bb3262914ad77f4692d21444dd5269efad368d89` (PR #5),
  including implementation commit
  `64f3591aceed509714bcaf6df6dcf6e2e93daaa1` (PR #4).
- **Accepted requirements baseline:** `6de1b60` (`spec: add baseline SRS, SDS,
  and Sprint 1 contracts`), with no approved baseline changes recorded in the
  traceability matrix.
- **Actual pre-change commit:** `d6b2fbbccc1eb23a163a55d9d2a6c634d9cb3676`
  (`HEAD` on `feature/lab7-issue-1-change-selection`) immediately before this
  proposal. This proposal changes documentation only.

The Sprint 1 implementation accepted at `64f3591` allowed `closesAt` to be
omitted or null, labeled the deadline optional in the creation UI, and already
accepted submissions when the campaign had no deadline. At the pre-change
commit, the campaign editor rejects publishing without a deadline and the API
schema independently rejects the same payload.

## Candidate 1 — Restore optional closing deadlines (selected)

### Existing behavior

At the pre-change commit, a Creator cannot publish a campaign without entering
a closing deadline: the UI stops the action with “Closing deadline is required
to publish a survey,” and the API rejects a published campaign without
`closesAt`. This is stricter than the Sprint 1 feature contract and the accepted
Sprint 1 implementation.

### Proposed behavior

Allow a Creator to publish a valid campaign with no closing deadline. Keep
validation that a supplied deadline must be valid and in the future. A
published campaign with `closesAt: null` remains available to Respondents and
accepts otherwise-valid submissions; status and duplicate-submission rules
remain unchanged.

### Requirement and scope evidence

- `F-02` / `FR-02`: Sprint 1 campaign creation and publishing.
- `F-03` / `FR-05`: Sprint 1 feedback submission.
- `BR-02`: Sprint 1 permits submission before `closesAt` “if set”; `CLOSED`
  campaigns remain rejected.
- `NFR-03`: campaign and submission persistence.
- Supporting docs: [features](../features.md), [SRS](../srs.md),
  [Sprint 1 contracts](../sprints/sprint-1/contracts.md), and
  [traceability](../traceability.md).

This does not add Sprint 2 lifecycle transitions, draft editing, submission
history, or any Sprint 3 capability.

### Modules and verification targets

- UI: [CreateCampaignPage.tsx](../../client/src/pages/CreateCampaignPage.tsx)
  currently blocks publishing without a deadline and marks the field required.
- API: [campaigns.ts](../../server/src/routes/campaigns.ts) currently requires
  `closesAt` for `PUBLISHED` campaigns. Its respondent listing and submission
  checks already account for a null deadline.
- Existing API/DB tests:
  [sprint1.test.ts](../../server/src/test/sprint1.test.ts) — TEST-04/AC-04
  (campaign creation), TEST-07/AC-07 (submission persistence), and
  TEST-09/AC-09 (closed campaign and validation behavior).
- Existing additional API coverage:
  [formFeatures.test.ts](../../server/src/test/formFeatures.test.ts) —
  expired-campaign exclusion and submission rejection.
- Existing UI journey contract: TEST-12 in
  [sts-dod.md](../sprints/sprint-1/sts-dod.md).

### Measurable Given/When/Then acceptance criteria

1. **Publish without a deadline**
   - **Given** an authenticated `CREATOR` and a valid campaign with a non-empty
     title and at least one valid question, with `closesAt` omitted or null
   - **When** the Creator publishes it through the UI/API
   - **Then** the API returns `201 Created`, persists `status: PUBLISHED` and
     `closesAt: null`, and the UI reports success without a deadline-required
     error.

2. **Browse and submit**
   - **Given** a persisted `PUBLISHED` campaign with `closesAt: null`
   - **When** an authenticated `RESPONDENT` lists campaigns and submits valid
     answers to it
   - **Then** the campaign appears in the list, submission returns
     `201 Created`, and PostgreSQL contains exactly one submission for that
     respondent/campaign with its submitted answers.

3. **Preserve deadline and status guards**
   - **Given** a Creator supplies a deadline that is not in the future, or a
     Respondent targets a `CLOSED` campaign
   - **When** the campaign is published or a submission is attempted,
     respectively
   - **Then** creation remains rejected with `400 Bad Request` for the invalid
     deadline, and submission remains rejected with `422 Unprocessable Entity`
     (`CAMPAIGN_NOT_OPEN`) for the closed campaign.

## Why this is the smallest meaningful change

It restores a documented Sprint 1 option that worked in the accepted baseline,
while the existing listing and submission paths already support campaigns
without a deadline. The change is confined to the publishing UI validation and
API campaign validation, needs no database migration, and has directly
measurable API/DB and UI acceptance outcomes. Existing deadline validation,
campaign status rules, and all unrelated Sprint 1 behavior remain in scope for
regression testing.
