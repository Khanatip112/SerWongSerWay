# UAT Execution Report: SerWongSerWay (PastelPulse) Sprint 1

## Release & Execution Metadata

| Item | Details |
|---|---|
| **Product Team** | SerWongSerWay (`https://github.com/Khanatip112/SerWongSerWay`) — Khanatip Nokkhunthot (`67070501008`, `@Khanatip112`), Chetsada Kiatkamonwong (`67070501080`, `@JKNIGHTSX`) |
| **UAT Team** | Yaowachatteamchon — Thanwarat Chanthana (`67070501025`, `@Thanwarat1303`), Aphisaimai (`67070501077`, `@mxckiexz`) |
| **Tested URL** | `https://serwongserway-vs56b635aq-as.a.run.app` |
| **Tested Versions** | **Round 1 (Initial UAT):** `main @ 752a76a`<br>**Round 2 (Part D Retest):** `main @ 9c7b9eb`, Cloud Run revision `serwongserway-00012-x7s` (fix commit `fbbcd07`, PR `#40`) |
| **Test Date & Time** | **Round 1:** 2026-11-26, 22:35–23:05 ICT (`+07:00`)<br>**Part D Retest:** 2026-11-28, 14:30–14:33 ICT (`+07:00`) |
| **Scope** | Sprint 1 contracts `AC-01` to `AC-12` (`docs/sprints/sprint-1/contracts.md`) and exploratory cases `EX-02` to `EX-09` |
| **Accounts Used (Passwords Omitted)** | Creator A (`james.and@gmail.com` / James Anderson), Creator B (`william`), Respondent A (`amelia.cla@gmail.com` / Amelia Clark), Respondent B (`daniel.rob@gmail.com` / Daniel Robinson) |
| **Test Method** | Manual execution via Chrome UI combined with authenticated API calls using active browser sessions; all recorded results reflect actual observed behavior. |
| **AI Assistance** | Claude (Claude Code) assisted with running test procedures, capturing screenshots, and drafting the initial report; all account logins were performed manually by students. |

---

## 1. Summary of Results

| Result | Count |
|---|---|
| **PASS** | 20 (Round 1) + 1 Retest (`EX-06` on `9c7b9eb`) |
| **FAIL** | 1 (`UAT-SWSW-01`, Major — fixed and verified `PASS` in Part D retest) |
| **BLOCKED** | 0 |
| **N/A (Intentionally Skipped)** | 1 |
| **Retest `EX-06` on `9c7b9eb`** | **PASS** (`UAT-SWSW-01` fixed and verified) |

- **Initial Acceptance Status (2026-11-26):** **Not Accepted** due to 1 open Major defect (`UAT-SWSW-01`).
- **Final Acceptance Decision (2026-11-28):** **Accepted with documented minor limitations.** `UAT-SWSW-01` (the sole Major defect) has been resolved and verified (`PASS` in Section 3.1), leaving zero Critical or Major defects. Minor observations `O-2` and `O-3` have been triaged and confirmed by the Product Team as accepted minor limitations / enhancements deferred to Sprint 2 (see Section 4).

---

## 2. Case-by-Case Test Results

| Case ID | Contract / AC | Time (ICT) | Input / Action | Actual Result | Status | Evidence |
|---|---|---|---|---|---|---|
| `B-SYS-01` | `AC-12` | 22:35 | `GET /api/ready` | `200 {"status":"ready", "database":"connected"}` | PASS | `evidence/EV01.png` |
| `B-AUTH-03` | `AC-03` | 22:35 | `GET /api/campaigns` without session cookie | `401 UNAUTHENTICATED` and no data leaked | PASS | `evidence/EV02.png` |
| `B-AUTH-02a` | `AC-02` | 22:35 | Login with non-existent email | `401 INVALID_CREDENTIALS` | PASS | API log |
| `B-CAM-06a` | `AC-06` | 22:38 | Creator A opens survey list | Displayed 8 surveys, all owned by Creator A | PASS | `evidence/EV03.png` |
| `B-CAM-04` | `AC-04` | 22:39 | Create `"UAT-Claude Main (EX)"` with `RATING_5` and `TEXT` questions | `201` and displayed in list as `"2 Questions"` | PASS | `evidence/EV04.png` |
| `B-CAM-05a` | `AC-05` | 22:39 | Create campaign with whitespace-only title | `400 "Title is required"` | PASS | API log |
| `B-CAM-05b` | `AC-05` | 22:39 | Create campaign with `questions: []` | `400 "At least one question is required..."` | PASS | API log |
| `EX-04a` | Business rule | 22:39 | Create campaign with `closesAt` in the past | `400 "Closing deadline must be in the future."` | PASS | API log |
| `B-CAM-05c` | `AC-05` (UI) | 22:40 | Click **Publish Survey** with empty title | Form shows `"Please fill out this field."` and does not create survey | PASS | `evidence/EV05.png` |
| `B-OWN-11a` | `AC-11` | 22:41 | Creator A opens Creator B's results (`...03`, `...06`, `...09`) | `403 FORBIDDEN_OWNER_ACCESS`, no data returned, and UI shows red alert banner | PASS | `evidence/EV06.png`, `evidence/EV07.png` |
| `EX-08` | `AC-02` | 22:42 | Click **Log out** then press browser **Back** button | Redirected to login screen with `"Please sign in to access that page."` and `/me` returns `401` | PASS | `evidence/EV09.png`, `evidence/EV10.png` |
| `B-CAM-06b` | `AC-06` | 22:46 | Respondent A opens survey list | Sees only 7 `PUBLISHED` surveys; `DRAFT` and `CLOSED` surveys are hidden | PASS | `evidence/EV11.png` |
| `EX-03` | `AC-09` / `BR-02` | 22:46 | Submit response after survey closing deadline | `422 CAMPAIGN_NOT_OPEN` | PASS | `evidence/EV14.png` |
| `EX-02` | `AC-09` / `BR-03` | 22:46 | Submit rating values `0`, `6`, and `4.5` | `400 BAD_REQUEST` for all three cases | PASS | `evidence/EV14.png` |
| `B-SUB-03` | `BR-03` | 22:46 | Submit response omitting required `TEXT` question | `400 BAD_REQUEST` | PASS | `evidence/EV14.png` |
| `B-SUB-07` | `AC-07` | 22:46 | Submit rating `5` with text answer | `201` and after page reload still displays `5/5` with text answer | PASS | `evidence/EV13.png`, `evidence/EV14.png` |
| `EX-09` | `AC-08` / `BR-01` | 22:46 | Send 2 concurrent submissions, then submit a 3rd time | Returns `201` once, `409 DUPLICATE_SUBMISSION` once, then `409` again | PASS | `evidence/EV13.png`, `evidence/EV14.png` |
| `B-OWN-11b` | `AC-11` | 22:46 | Respondent opens results page | `403` with no data (error code is `FORBIDDEN`, see `O-2`) | PASS | `evidence/EV12.png`, `evidence/EV14.png` |
| `B-CAM-05d` | `AC-05` | 22:46 | Respondent attempts `POST /api/campaigns` | `403 FORBIDDEN` | PASS | `evidence/EV14.png` |
| `B-SUB-07b` | `AC-07` | 22:57 | Respondent B submits rating `4` with text answer | `201` and UI displays `4/5` with text answer | PASS | `evidence/EV15.png` |
| `B-RES-10` | `AC-10` | 23:04 | Creator A opens survey results | Total `2`, average `4.5` (expected `(5+4)/2 = 4.5`), and all answers displayed | PASS | `evidence/EV16.png`, `evidence/EV17.png` |
| `EX-06` | `AC-10` / `AC-07` | 23:05 | Edit a `PUBLISHED` survey that already has submissions by removing Question 2 | Saved without warning and both respondents' text answers were permanently deleted | FAIL | `evidence/EV18.png` to `evidence/EV22.png` |
| `EX-06` (Retest) | `AC-10` / `AC-07` | 2026-11-28 14:31 | On `9c7b9eb`: open `/campaigns/<id>/edit` for `PUBLISHED` survey and send `PUT` to modify questions | Edit page is locked (`"Survey Cannot Be Edited"`), `PUT` returns `409 CAMPAIGN_NOT_EDITABLE`, and existing answers remain intact | PASS | `evidence/D-EV01.png` to `evidence/D-EV06.png` |
| Creator B Round | `AC-11` | N/A | Intentionally skipped | Cross-owner results access already verified in `B-OWN-11a` | N/A | None |

---

## 3. Defect Report (`UAT-SWSW-01`)

### `UAT-SWSW-01`: Editing a published survey permanently deletes previously submitted respondent answers

| Field | Details |
|---|---|
| **Issue ID** | `UAT-SWSW-01` |
| **Product Team** | SerWongSerWay |
| **Reported By** | Independent UAT Team (`Yaowachatteamchon`) |
| **Tested Version** | `main @ 752a76a` |
| **Case / Requirement** | `EX-06`; `AC-10` ("all persisted respondent answers") and `AC-07` ("durably stored") |
| **Severity** | **Major:** User-submitted data is permanently destroyed with no warning or undo, while the submission count and average rating still appear normal, causing the Creator not to notice data loss. |
| **Preconditions** | Creator A owns a `PUBLISHED` survey with Q1 (`RATING_5`) and Q2 (`TEXT`), both required. Respondent A submitted rating `5` with text `"Amelia concurrent A"`, and Respondent B submitted rating `4` with text `"Daniel UAT answer"`. |
| **Reproduction Steps** | 1. Log in as Creator A (`james.and@gmail.com`).<br>2. Open `/campaigns/<id>/results` and confirm 2 submissions with text answers exist.<br>3. Open `/campaigns/<id>/edit` (page displays `"Edit Survey Draft"` even though the survey is `PUBLISHED`).<br>4. Click **Remove** on Question 2.<br>5. Click **Publish Survey**.<br>6. Re-open `/campaigns/<id>/results`. |
| **Expected Result** | Previously submitted answers remain intact, or the system blocks editing/deleting questions once published/answered (or at minimum requires explicit confirmation with a data-loss warning). |
| **Actual Result** | The update saves immediately without warning; `"Total Submissions 2"` is still shown, but text answers `"Daniel UAT answer"` and `"Amelia concurrent A"` are permanently deleted. |
| **Root Cause** | `PUT /api/campaigns/:id` (`server/src/routes/campaigns.ts`) executes `tx.question.deleteMany({ where: { campaignId: id, id: { notIn: keepQuestionIds } } })` and `Answer.question` (`server/prisma/schema.prisma`) uses `onDelete: Cascade` without checking whether the campaign is `DRAFT` or already has submissions. |
| **Category** | Defect violating Sprint 1 contract (`AC-07`, `AC-10`), not a feature request. |
| **Product Team Triage & Resolution** | **Accepted Defect.** Verified via TDD workflow (`evidence/DEV-01-vitest-red.png` reproducing failure on `752a76a` -> `evidence/DEV-02-vitest-green.png` passing full suite after fix). Fixed in commit `fbbcd07` (PR `#40`, merged into `main @ 9c7b9eb`) by locking the edit UI for non-`DRAFT` surveys, returning `409 CAMPAIGN_NOT_EDITABLE` from `PUT /api/campaigns/:id` when `status !== "DRAFT"`, and adding regression test `server/src/test/uat-swsw-01.test.ts`. |
| **Status** | **Closed (Fixed & Verified)** — Retested and passed on 2026-11-28 (see Section 3.1). |
| **Round 1 Evidence** | `evidence/EV17.png`, `evidence/EV18.png`, `evidence/EV19.png`, `evidence/EV20.png`, `evidence/EV21.png`, `evidence/EV22.png` |

### 3.1 Retest of `UAT-SWSW-01` (Part D)

| Item | Details |
|---|---|
| **Retested Version** | `main @ 9c7b9eb`, Cloud Run revision `serwongserway-00012-x7s` on `https://serwongserway-vs56b635aq-as.a.run.app` |
| **Tester** | UAT Team assisted by Claude, signed in as Creator A (manual student login) |
| **Date & Time** | 2026-11-28, 14:30–14:33 ICT (`+07:00`) |
| **Initial State** | Survey `"UAT-Claude Main (EX)"` (`2d1715e8-4ab7-40f2-ae45-d94eb7356b7e`, `PUBLISHED`) with 2 submissions (Respondent B rating `4`, Respondent A rating `5`) and closed survey `"UAT-Claude Closing Soon (EX-03)"` (`db4f5be9-51e9-4355-b2b3-b3c2825da405`, `CLOSED`). |

| Step | Action | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| 1 | Open `/campaigns/<id>/results` before retest | 2 submissions, average `4.5` | Matches expected (`evidence/D-EV01.png`) | PASS |
| 2 | Navigate directly to `/campaigns/<id>/edit` for a `PUBLISHED` survey | Editing is blocked | Displays `"Survey Cannot Be Edited"` stating published/closed surveys are locked, with no edit form (`evidence/D-EV02.png`) | PASS |
| 3 | Send `PUT /api/campaigns/:id` on `PUBLISHED` survey replacing Q1 with a new `TEXT` question | Rejected | `409 CAMPAIGN_NOT_EDITABLE` (`evidence/D-EV05.png`, `evidence/D-EV06.png`) | PASS |
| 4 | Send `PUT /api/campaigns/:id` on `PUBLISHED` survey with `status: "DRAFT"` and `questions: []` | Rejected (cannot bypass by resetting status to `DRAFT`) | `409 CAMPAIGN_NOT_EDITABLE` (`evidence/D-EV05.png`, `evidence/D-EV06.png`) | PASS |
| 5 | Send `PUT /api/campaigns/:id` on `CLOSED` survey (`EX-03`) | Rejected | `409 CAMPAIGN_NOT_EDITABLE` (`evidence/D-EV05.png`, `evidence/D-EV06.png`) | PASS |
| 6 | Re-open `/campaigns/<id>/results` after all `PUT` attempts | Existing responses remain intact | Still 2 submissions, average `4.5`, and ratings `4` and `5` preserved (`evidence/D-EV03.png`) | PASS |
| 7 | **Regression:** Create a new `DRAFT` survey and edit it | `DRAFT` remains editable as normal | `POST` returns `201`, `PUT` (rename + add question) returns `200`, and `/edit` renders the form (`evidence/D-EV04.png`) | PASS |
| 8 | Send `PUT /api/campaigns/:id` without authentication cookie | `401` | `401 UNAUTHENTICATED` (`evidence/D-EV06.png`) | PASS |

- **Disclosed Limitation Note:** The two text answers deleted during Round 1 (`"Daniel UAT answer"` and `"Amelia concurrent A"`) cannot be restored because the fix prevents future data loss rather than recovering prior deletions. Only synthetic UAT test records were affected; no production user data was impacted.

---

## 4. Minor Observations & Product Team Triage

The UAT Team logged three non-blocking observations for Product Team triage. The Product Team reviewed and confirmed the final disposition for all three items (not modified in Sprint 1):

| ID | UAT Observation | Proposed Severity | Product Team Triage Decision | Rationale |
|---|---|---|---|---|
| `O-2` | When a Respondent accesses `GET /api/campaigns/:id/results`, the API correctly blocks access with HTTP `403`, but returns error code `"FORBIDDEN"` instead of `"FORBIDDEN_OWNER_ACCESS"` listed in STS `TEST-11` (`evidence/EV14.png`). | Minor | **Accepted as minor limitation (Will not fix in Sprint 1; deferred to Sprint 2)** | Access control (`403` with zero data leakage) satisfies Sprint 1 contract `AC-11`. Keeping the existing error code string avoids breaking existing Sprint 1 test assertions and will be aligned in Sprint 2. |
| `O-3` | `GET /api/campaigns/:id` includes `creator.email` in the campaign detail payload visible to respondents (`evidence/EV14.png`). | Enhancement | **Enhancement (Will not fix in Sprint 1; deferred to Sprint 2)** | Not prohibited by Sprint 1 contracts (`AC-01` to `AC-12`); deferred to Sprint 2 payload minimization. |
| `O-1` | A transient `"Loading surveys..."` state appeared once after a `403` redirect, but was not reproducible on retry (`evidence/EV08.png`). | Not a defect | **Not a defect** | Non-reproducible transient state; normal survey list loading confirmed in `evidence/EV08.png`. |

---

## 5. Handoff & Cleanup Notes

1. **Triage Confirmation:** `UAT-SWSW-01` is closed and verified (`PASS`). Minor observations `O-2` and `O-3` are formally documented and accepted as Sprint 1 minor limitations / enhancements deferred to Sprint 2.
2. **Test Data Cleanup:** Synthetic test campaigns created by the UAT Team (`"UAT-Claude Main (EX)"` `2d1715e8...`, `"UAT-Claude Closing Soon (EX-03)"` `db4f5be9...`, and `"UAT-Claude Retest Draft (regression) v2"` `9883b735...`, along with Respondent A/B test submissions) may be deleted by the Product Team now that retesting is complete.

---

## 6. Appendix: Evidence File Index

All evidence screenshots captured from the UAT report are stored in `docs/labs/lab-06/evidence/`:

- `evidence/EV01.png` — `GET /api/ready` returns `200` (`database: connected`)
- `evidence/EV02.png` — `GET /api/campaigns` unauthenticated returns `401 UNAUTHENTICATED`
- `evidence/EV03.png` — Creator A views only own 8 surveys
- `evidence/EV04.png` — Created test surveys listed (`10` surveys)
- `evidence/EV05.png` — UI validation blocks publishing with empty title
- `evidence/EV06.png` — Creator A blocked from viewing Creator B's results in UI
- `evidence/EV07.png` — API returns `403 FORBIDDEN_OWNER_ACCESS`
- `evidence/EV08.png` — Survey list loads normally after `403`
- `evidence/EV09.png` — Logout returns to login page
- `evidence/EV10.png` — Browser Back after logout blocked (`"Please sign in to access that page."`)
- `evidence/EV11.png` — Respondent A views only 7 `PUBLISHED` surveys
- `evidence/EV12.png` — Respondent blocked from accessing results page in UI
- `evidence/EV13.png` — Persisted response displayed and duplicate submission blocked
- `evidence/EV14.png` — Respondent A API verification log
- `evidence/EV15.png` — Respondent B submits rating `4` with text answer
- `evidence/EV16.png` — Results summary shows Total `2`, average `4.5`
- `evidence/EV17.png` — Round 1 before edit: both submissions retain text answers
- `evidence/EV18.png` — Round 1 bug: edit form opened on `PUBLISHED` survey
- `evidence/EV19.png` — Round 1 bug: Question 2 removed on `PUBLISHED` survey
- `evidence/EV20.png` — Round 1 after save: `1 Questions`, `2 Submissions`
- `evidence/EV21.png` — Round 1 after edit: respondent text answers permanently deleted
- `evidence/EV22.png` — Round 1 API state before/after edit and root cause log
- `evidence/D-EV01.png` — Part D retest before: 2 submissions, average `4.5`
- `evidence/D-EV02.png` — Part D retest: `/campaigns/<id>/edit` locked (`"Survey Cannot Be Edited"`)
- `evidence/D-EV03.png` — Part D retest after: submissions and answers preserved
- `evidence/D-EV04.png` — Part D regression: `DRAFT` survey still editable
- `evidence/D-EV05.png` — Part D API retest screenshot (`409 CAMPAIGN_NOT_EDITABLE`)
- `evidence/D-EV06.png` — Part D API retest full log
- `evidence/DEV-01-vitest-red.png` — Developer TDD RED run: `server/src/test/uat-swsw-01.test.ts` failing before fix on `752a76a`
- `evidence/DEV-02-vitest-green.png` — Developer TDD GREEN run: full test suite passing after fix in `fbbcd07`