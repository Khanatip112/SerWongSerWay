# RED Test Evidence

## Test setup

- **Pre-change application commit:** `1412fdae4dc487bdfd81c9e93f985252fd0d1cf3`
- **Production implementation:** unchanged from that commit during this run.
- **Test file:** `server/src/test/sprint1.test.ts`
- **Test IDs:** TEST-13 and TEST-14 (AC-13/AC-14, FR-11, BR-02/BR-03/BR-06)
- **Command:** `npm test --workspace=server -- --reporter=verbose -t "TEST-13|TEST-14"`
- **Database:** disposable PostgreSQL 16 container on `localhost:5433`, initialized to the Prisma schema with `npm run db:push --workspace=server`. No application source or dependency manifests were changed for setup.

The earlier attempts made before PostgreSQL was available failed during database access and are not counted as RED evidence. This run reached and executed the selected tests.

## Actual result

Vitest reported:

```text
Test Files  1 failed | 2 skipped (3)
     Tests  2 failed | 2 passed | 54 skipped (58)
```

The failures were behavior mismatches against the new contract:

```text
TEST-13 ... should replace answers, keep one submission, and update the submitted time
Expected: 200
Received: 409

TEST-14 ... should reject an invalid revision without changing the saved response
Expected: 400
Received: 409
```

The two passing tests verified that expiry/closure guards and authentication, role, and respondent isolation remain enforced. The failing requests received the existing duplicate-submission response before the required revision and invalid-payload behavior, so the RED result is caused by the missing maintenance behavior rather than setup or compilation errors.
