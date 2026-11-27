# GREEN Test Evidence

## Targeted tests

- **Pre-change application SHA:** `1412fdae4dc487bdfd81c9e93f985252fd0d1cf3`
- **Tested implementation commit SHA:** `203465aade8afdbd26cfd5c2a209fd7c5c30644d`
- **Test file:** `server/src/test/sprint1.test.ts`
- **Test IDs:** TEST-13 and TEST-14 (AC-13/AC-14, FR-11, BR-02/BR-03/BR-06)
- **Command (same as RED):** `npm test --workspace=server -- --reporter=verbose -t "TEST-13|TEST-14"`
- **Database:** Same disposable PostgreSQL 16 test database on `localhost:5433`.

After committing the implementation, the exact targeted command was rerun
against the tested implementation commit. The four selected tests passed
without changing the assertions from the RED run:

```text
✓ TEST-13 ... should replace answers, keep one submission, and update the submitted time
✓ TEST-14 ... should reject an invalid revision without changing the saved response
✓ TEST-14 ... should reject revisions after expiry or closure and preserve the original response
✓ TEST-14 ... should preserve authentication, role, and respondent isolation

Test Files  1 passed | 2 skipped (3)
     Tests  4 passed | 54 skipped (58)
Exit code: 0
```

The skips are the other two test files and unrelated tests filtered out by the targeted `-t` selector; none of TEST-13/TEST-14 was skipped.

## Build verification

- `npm run build --workspace=server` — passed (`tsc`, exit code 0).
- `npm run build --workspace=client` — passed (`tsc` and Vite production build, exit code 0).

The builds emitted no compilation errors.
