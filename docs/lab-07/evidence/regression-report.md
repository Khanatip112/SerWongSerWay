# Regression Test Report

## Environment and commands

- Tests ran against a disposable PostgreSQL 16 database on `localhost:5433`.
- `npm test --workspace=server -- --reporter=verbose`
- `npm test --workspace=client -- --reporter=verbose`
- Both commands exited 0.

## Results

| Suite | Result | Relevance |
|---|---|---|
| Server `src/test/sprint1.test.ts` | Passed; included in 58 total server tests | Covers first submission persistence (TEST-07), the revised submission lifecycle (TEST-13/14), authentication and role guards (TEST-01/03), closed-campaign and answer boundaries (TEST-09), results output (TEST-10), and creator ownership (TEST-11). |
| Server `src/test/formFeatures.test.ts` | Passed; included in 58 total server tests | Covers shared validation, branching/visited-section rules, submission persistence, results formatting, and `GET /api/campaigns/:id` respondent submission data. These are dependencies or callers of revised answer validation and persistence. |
| Server `src/routes/health.test.ts` | Passed; included in 58 total server tests | Verifies health/readiness endpoints. It is an unaffected server regression suite; its expected simulated database refusal was logged by its test. |
| Client `src/components/Alert.test.tsx` | Passed; 4 tests | Confirms existing alert rendering remains intact. The repository has no dedicated `RespondPage` or `FormRenderer` automated UI tests, so respondent-form initialization was build-checked but not independently DOM-tested. |

Final totals:

```text
Server: Test Files 3 passed (3); Tests 58 passed (58)
Client: Test Files 1 passed (1); Tests 4 passed (4)
```

The old TEST-08 duplicate-rejection result is intentionally superseded only for a valid repeat submission while the campaign is open. The revised tests still verify a single stored submission; first submissions, invalid answers, closed/expired campaigns, authentication, role restrictions, respondent isolation, results, and ownership all passed.

## Notes

- No application schema or migration was needed; the existing compound unique constraint remains.
- The test output includes existing Vite CJS and Node `url.parse()` deprecation warnings. They did not fail either suite.
- No deployment was performed.
