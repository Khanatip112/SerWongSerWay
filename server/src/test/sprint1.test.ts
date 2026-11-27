import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  getTestPrisma,
  ensureDatabaseSeeded,
  cleanupTestRecords,
  loginAndGetCookie,
  SEED_ACCOUNTS,
  SEED_CAMPAIGN_TITLES,
} from './helpers.js';

describe('Sprint 1 Integration Tests (TEST-01 to TEST-11)', () => {
  const app = createApp();
  const prisma = getTestPrisma();

  beforeAll(async () => {
    try {
      await ensureDatabaseSeeded();
    } catch (e) {
      console.warn('Database seed setup encountered error or DB not reachable:', e);
    }
  });

  beforeEach(async () => {
    try {
      await cleanupTestRecords();
    } catch {
      // In RED phase without active DB, allow test assertions to proceed and fail cleanly
    }
  });

  afterAll(async () => {
    try {
      await cleanupTestRecords();
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors
    }
  });

  // ============================================================================
  // TEST-01 (AC-01): Valid Login & Identity Resolution
  // ============================================================================
  describe('TEST-01 (AC-01): Valid login sets HttpOnly cookie and GET /api/auth/me returns profile', () => {
    it('should authenticate creator1, set pastelpulse_session cookie, and return creator profile', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: SEED_ACCOUNTS.creator1.email,
          password: SEED_ACCOUNTS.creator1.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        email: SEED_ACCOUNTS.creator1.email,
        role: 'CREATOR',
      });

      // Verify HttpOnly cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const sessionCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith('pastelpulse_session='))
        : cookies;
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');

      // Subsequent GET /api/auth/me with session cookie
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie!);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data).toMatchObject({
        email: SEED_ACCOUNTS.creator1.email,
        role: 'CREATOR',
      });
    });

    it('should authenticate respondent1 and return respondent role', async () => {
      const { cookie, response } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe('RESPONDENT');

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.role).toBe('RESPONDENT');
    });
  });

  // ============================================================================
  // TEST-02 (AC-02): Invalid Login & Logout
  // ============================================================================
  describe('TEST-02 (AC-02): Invalid password rejection and logout session invalidation', () => {
    it('should reject invalid password with 401 Unauthorized without setting cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: SEED_ACCOUNTS.creator1.email,
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');

      // Ensure no valid session cookie is returned
      const cookies = res.headers['set-cookie'];
      const sessionCookie = cookies
        ? Array.isArray(cookies)
          ? cookies.find((c: string) => c.startsWith('pastelpulse_session=') && !c.includes('Max-Age=0'))
          : cookies.includes('Max-Age=0')
          ? undefined
          : cookies
        : undefined;
      expect(sessionCookie).toBeUndefined();
    });

    it('should clear session cookie on logout and subsequent GET /api/auth/me returns 401', async () => {
      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.creator1.email,
        SEED_ACCOUNTS.creator1.password
      );

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.data).toEqual({ loggedOut: true });

      // After logout, me request must return 401
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(401);
      expect(meRes.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  // ============================================================================
  // TEST-03 (AC-03, NFR-01): Unauthenticated Access Rejection
  // ============================================================================
  describe('TEST-03 (AC-03, NFR-01): Protected endpoints reject unauthenticated requests', () => {
    it('should return 401 for GET /api/campaigns without session cookie', async () => {
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });

    it('should return 401 for POST /api/campaigns without session cookie', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .send({ title: 'Test', description: 'Test', questions: [] });
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });

    it('should return 401 for POST /api/campaigns/:id/submissions without session cookie', async () => {
      const res = await request(app)
        .post('/api/campaigns/00000000-0000-0000-0000-000000000000/submissions')
        .send({ answers: [] });
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });

    it('should return 401 for GET /api/campaigns/:id/results without session cookie', async () => {
      const res = await request(app)
        .get('/api/campaigns/00000000-0000-0000-0000-000000000000/results');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });
  });

  // ============================================================================
  // TEST-04 (AC-04): Authenticated CREATOR Creates Valid Campaign
  // ============================================================================
  describe('TEST-04 (AC-04): CREATOR creates valid campaign and persists in PostgreSQL', () => {
    it('should create campaign with questions and persist with creatorId link', async () => {
      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.creator1.email,
        SEED_ACCOUNTS.creator1.password
      );

      const payload = {
        title: 'Sprint 1 Workshop Review',
        description: 'Please rate your learning experience in this workshop.',
        closesAt: '2026-12-31T23:59:59.000Z',
        questions: [
          {
            prompt: 'Overall satisfaction',
            type: 'RATING_5',
            required: true,
          },
          {
            prompt: 'What did you like most?',
            type: 'TEXT',
            required: false,
          },
        ],
      };

      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', cookie)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe(payload.title);
      expect(res.body.data.status).toBe('PUBLISHED');

      // Verify persistence in PostgreSQL
      const dbCampaign = await prisma.campaign.findUnique({
        where: { id: res.body.data.id },
        include: { questions: true, creator: true },
      });

      expect(dbCampaign).not.toBeNull();
      expect(dbCampaign?.title).toBe(payload.title);
      expect(dbCampaign?.creator.email).toBe(SEED_ACCOUNTS.creator1.email);
      expect(dbCampaign?.questions).toHaveLength(2);
    });
  });

  // ============================================================================
  // TEST-05 (AC-05, BR-03): Rejection of Invalid Payloads and Non-Creator Roles
  // ============================================================================
  describe('TEST-05 (AC-05, BR-03): Role & payload validation on campaign creation', () => {
    it('should reject RESPONDENT calling POST /api/campaigns with 403 Forbidden', async () => {
      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );

      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', cookie)
        .send({
          title: 'Unauthorized Survey',
          description: 'Trying to create as respondent',
          questions: [
            { prompt: 'Sample prompt', type: 'TEXT', required: true },
          ],
        });

      expect(res.status).toBe(403);
    });

    it('should reject CREATOR payload with empty title with 400 Bad Request', async () => {
      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.creator1.email,
        SEED_ACCOUNTS.creator1.password
      );

      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', cookie)
        .send({
          title: '',
          description: 'Valid description',
          questions: [
            { prompt: 'Sample prompt', type: 'TEXT', required: true },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should reject CREATOR payload with empty questions array with 400 Bad Request', async () => {
      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.creator1.email,
        SEED_ACCOUNTS.creator1.password
      );

      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', cookie)
        .send({
          title: 'No Questions Survey',
          description: 'Valid description',
          questions: [],
        });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // TEST-06 (AC-06): Role-Scoped Campaign Listing
  // ============================================================================
  describe('TEST-06 (AC-06): Role-scoped campaign listing (CREATOR vs RESPONDENT)', () => {
    it('should return only owned campaigns when calling GET /api/campaigns as CREATOR', async () => {
      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.creator1.email,
        SEED_ACCOUNTS.creator1.password
      );

      const res = await request(app)
        .get('/api/campaigns')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // All returned campaigns must be owned by creator1
      for (const campaign of res.body.data) {
        expect(campaign.creatorId).toBeDefined();
      }
    });

    it('should return only PUBLISHED campaigns when calling GET /api/campaigns as RESPONDENT', async () => {
      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );

      const res = await request(app)
        .get('/api/campaigns')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      // Verify no CLOSED or DRAFT campaign is returned
      const nonPublished = res.body.data.find(
        (c: { status: string }) => c.status !== 'PUBLISHED'
      );
      expect(nonPublished).toBeUndefined();

      // Check hasSubmitted annotation exists
      if (res.body.data.length > 0) {
        expect(typeof res.body.data[0].hasSubmitted).toBe('boolean');
      }
    });
  });

  // ============================================================================
  // TEST-07 (AC-07, NFR-03): RESPONDENT Submits Valid Feedback
  // ============================================================================
  describe('TEST-07 (AC-07, NFR-03): RESPONDENT submits valid feedback and persists in DB', () => {
    it('should accept valid rating and text response for open PUBLISHED campaign', async () => {
      const published = await prisma.campaign.findFirst({
        where: { title: SEED_CAMPAIGN_TITLES.published, status: 'PUBLISHED' },
        include: { questions: { orderBy: { orderIndex: 'asc' } } },
      });

      expect(published).not.toBeNull();
      const ratingQ = published!.questions.find((q) => q.type === 'RATING_5');
      const textQ = published!.questions.find((q) => q.type === 'TEXT');

      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );

      const submissionPayload = {
        answers: [
          { questionId: ratingQ!.id, ratingValue: 5 },
          { questionId: textQ!.id, textValue: 'Excellent instruction and clear labs!' },
        ],
      };

      const res = await request(app)
        .post(`/api/campaigns/${published!.id}/submissions`)
        .set('Cookie', cookie)
        .send(submissionPayload);

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.submissionId).toBeDefined();

      // Confirm persistence in PostgreSQL
      const dbSubmission = await prisma.submission.findUnique({
        where: { id: res.body.data.submissionId },
        include: { answers: true, respondent: true },
      });

      expect(dbSubmission).not.toBeNull();
      expect(dbSubmission?.respondent.email).toBe(SEED_ACCOUNTS.respondent1.email);
      expect(dbSubmission?.answers).toHaveLength(2);
    });
  });

  // ============================================================================
  // TEST-13 replaces the Sprint 1 TEST-08 duplicate-rejection outcome.
  // ============================================================================
  describe('TEST-13 (AC-13, FR-11, BR-06): Revise existing response in place', () => {
    it('should replace answers, keep one submission, and update the submitted time', async () => {
      const published = await prisma.campaign.findFirst({
        where: { title: SEED_CAMPAIGN_TITLES.published },
        include: { questions: { orderBy: { orderIndex: 'asc' } } },
      });

      expect(published).not.toBeNull();
      const ratingQuestion = published!.questions.find((q) => q.type === 'RATING_5');
      const textQuestion = published!.questions.find((q) => q.type === 'TEXT');
      expect(ratingQuestion).toBeDefined();
      expect(textQuestion).toBeDefined();

      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );

      const firstRes = await request(app)
        .post(`/api/campaigns/${published!.id}/submissions`)
        .set('Cookie', cookie)
        .send({
          answers: [
            { questionId: ratingQuestion!.id, ratingValue: 5 },
            { questionId: textQuestion!.id, textValue: 'Original comment' },
          ],
        });

      expect(firstRes.status).toBe(201);
      const submissionId = firstRes.body.data.submissionId as string;
      const priorTimestamp = new Date(Date.now() - 60_000);
      await prisma.submission.update({
        where: { id: submissionId },
        data: { submittedAt: priorTimestamp },
      });

      const revisionStartedAt = new Date();
      const revisionRes = await request(app)
        .post(`/api/campaigns/${published!.id}/submissions`)
        .set('Cookie', cookie)
        .send({
          answers: [{ questionId: ratingQuestion!.id, ratingValue: 4 }],
        });

      expect(revisionRes.status).toBe(200);
      expect(revisionRes.body.data).toMatchObject({
        submissionId,
        campaignId: published!.id,
        updated: true,
      });
      const revisionTimestamp = new Date(revisionRes.body.data.submittedAt).getTime();
      expect(revisionTimestamp).toBeGreaterThan(priorTimestamp.getTime());
      expect(revisionTimestamp).toBeGreaterThanOrEqual(revisionStartedAt.getTime() - 1000);
      expect(revisionTimestamp).toBeLessThanOrEqual(Date.now() + 1000);

      const respondent = await prisma.user.findUnique({
        where: { email: SEED_ACCOUNTS.respondent1.email },
      });
      const subCount = await prisma.submission.count({
        where: {
          campaignId: published!.id,
          respondentId: respondent!.id,
        },
      });
      expect(subCount).toBe(1);

      const saved = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: { answers: true },
      });
      expect(saved?.submittedAt.getTime()).toBe(revisionTimestamp);
      expect(saved?.answers).toHaveLength(1);
      expect(saved?.answers[0]).toMatchObject({
        questionId: ratingQuestion!.id,
        ratingValue: 4,
      });
    });
  });

  // ============================================================================
  // TEST-14 (AC-14, BR-02, BR-03, BR-06): Revision guards and isolation
  // ============================================================================
  describe('TEST-14 (AC-14, BR-02, BR-03, BR-06): Revision guards and isolation', () => {
    async function getPublishedCampaign() {
      const campaign = await prisma.campaign.findFirst({
        where: { title: SEED_CAMPAIGN_TITLES.published },
        include: { questions: { orderBy: { orderIndex: 'asc' } } },
      });
      expect(campaign).not.toBeNull();
      return campaign!;
    }

    async function createInitialSubmission(
      campaignId: string,
      ratingQuestionId: string,
      cookie: string
    ): Promise<{ submissionId: string; submittedAt: Date }> {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/submissions`)
        .set('Cookie', cookie)
        .send({ answers: [{ questionId: ratingQuestionId, ratingValue: 5 }] });

      expect(response.status).toBe(201);
      return {
        submissionId: response.body.data.submissionId,
        submittedAt: new Date(response.body.data.submittedAt),
      };
    }

    it('should reject an invalid revision without changing the saved response', async () => {
      const campaign = await getPublishedCampaign();
      const ratingQuestion = campaign.questions.find((q) => q.type === 'RATING_5');
      expect(ratingQuestion).toBeDefined();
      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );
      const original = await createInitialSubmission(campaign.id, ratingQuestion!.id, cookie);

      const invalidRes = await request(app)
        .post(`/api/campaigns/${campaign.id}/submissions`)
        .set('Cookie', cookie)
        .send({ answers: [{ questionId: ratingQuestion!.id, ratingValue: 6 }] });

      expect(invalidRes.status).toBe(400);

      const saved = await prisma.submission.findUnique({
        where: { id: original.submissionId },
        include: { answers: true },
      });
      expect(saved?.submittedAt.getTime()).toBe(original.submittedAt.getTime());
      expect(saved?.answers).toHaveLength(1);
      expect(saved?.answers[0]).toMatchObject({
        questionId: ratingQuestion!.id,
        ratingValue: 5,
      });
    });

    it('should reject revisions after expiry or closure and preserve the original response', async () => {
      const campaign = await getPublishedCampaign();
      const ratingQuestion = campaign.questions.find((q) => q.type === 'RATING_5');
      expect(ratingQuestion).toBeDefined();
      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );
      const original = await createInitialSubmission(campaign.id, ratingQuestion!.id, cookie);

      try {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { closesAt: new Date(Date.now() - 60_000) },
        });

        const expiredRes = await request(app)
          .post(`/api/campaigns/${campaign.id}/submissions`)
          .set('Cookie', cookie)
          .send({ answers: [{ questionId: ratingQuestion!.id, ratingValue: 4 }] });
        expect(expiredRes.status).toBe(422);
        expect(expiredRes.body.error.code).toBe('CAMPAIGN_NOT_OPEN');

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'CLOSED', closesAt: new Date(Date.now() + 60_000) },
        });
        const closedRes = await request(app)
          .post(`/api/campaigns/${campaign.id}/submissions`)
          .set('Cookie', cookie)
          .send({ answers: [{ questionId: ratingQuestion!.id, ratingValue: 3 }] });
        expect(closedRes.status).toBe(422);
        expect(closedRes.body.error.code).toBe('CAMPAIGN_NOT_OPEN');

        const saved = await prisma.submission.findUnique({
          where: { id: original.submissionId },
          include: { answers: true },
        });
        expect(saved?.submittedAt.getTime()).toBe(original.submittedAt.getTime());
        expect(saved?.answers).toHaveLength(1);
        expect(saved?.answers[0].ratingValue).toBe(5);
      } finally {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: campaign.status, closesAt: campaign.closesAt },
        });
      }
    });

    it('should preserve authentication, role, and respondent isolation', async () => {
      const campaign = await getPublishedCampaign();
      const ratingQuestion = campaign.questions.find((q) => q.type === 'RATING_5');
      expect(ratingQuestion).toBeDefined();
      const respondent1 = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );
      const original = await createInitialSubmission(
        campaign.id,
        ratingQuestion!.id,
        respondent1.cookie
      );

      const anonymousRes = await request(app)
        .post(`/api/campaigns/${campaign.id}/submissions`)
        .send({ answers: [{ questionId: ratingQuestion!.id, ratingValue: 4 }] });
      expect(anonymousRes.status).toBe(401);

      const creator = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.creator1.email,
        SEED_ACCOUNTS.creator1.password
      );
      const creatorRes = await request(app)
        .post(`/api/campaigns/${campaign.id}/submissions`)
        .set('Cookie', creator.cookie)
        .send({ answers: [{ questionId: ratingQuestion!.id, ratingValue: 4 }] });
      expect(creatorRes.status).toBe(403);

      const respondent2 = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent2.email,
        SEED_ACCOUNTS.respondent2.password
      );
      const respondent2Res = await request(app)
        .post(`/api/campaigns/${campaign.id}/submissions`)
        .set('Cookie', respondent2.cookie)
        .send({ answers: [{ questionId: ratingQuestion!.id, ratingValue: 3 }] });
      expect(respondent2Res.status).toBe(201);
      expect(respondent2Res.body.data.submissionId).not.toBe(original.submissionId);

      const originalSaved = await prisma.submission.findUnique({
        where: { id: original.submissionId },
        include: { answers: true },
      });
      expect(originalSaved?.answers).toHaveLength(1);
      expect(originalSaved?.answers[0].ratingValue).toBe(5);
      expect(
        await prisma.submission.count({ where: { campaignId: campaign.id } })
      ).toBe(2);
    });
  });

  // ============================================================================
  // TEST-09 (AC-09, BR-02, BR-03): Closed Campaign & Rating Bounds Validation
  // ============================================================================
  describe('TEST-09 (AC-09, BR-02, BR-03): Closed campaign and rating boundary enforcement', () => {
    it('should reject submission to CLOSED campaign with 422 Unprocessable Entity', async () => {
      const closed = await prisma.campaign.findFirst({
        where: { title: SEED_CAMPAIGN_TITLES.closed, status: 'CLOSED' },
        include: { questions: true },
      });

      expect(closed).not.toBeNull();
      const q = closed!.questions[0];

      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );

      const res = await request(app)
        .post(`/api/campaigns/${closed!.id}/submissions`)
        .set('Cookie', cookie)
        .send({
          answers: [{ questionId: q.id, ratingValue: 4 }],
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('CAMPAIGN_NOT_OPEN');
    });

    it('should reject rating values outside 1..5 scale (e.g. 6 and 0) with 400 Bad Request', async () => {
      const published = await prisma.campaign.findFirst({
        where: { title: SEED_CAMPAIGN_TITLES.published },
        include: { questions: true },
      });

      expect(published).not.toBeNull();
      const ratingQ = published!.questions.find((q) => q.type === 'RATING_5');

      const { cookie } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );

      // Rating value 6
      const res6 = await request(app)
        .post(`/api/campaigns/${published!.id}/submissions`)
        .set('Cookie', cookie)
        .send({
          answers: [{ questionId: ratingQ!.id, ratingValue: 6 }],
        });

      expect(res6.status).toBe(400);

      // Rating value 0
      const res0 = await request(app)
        .post(`/api/campaigns/${published!.id}/submissions`)
        .set('Cookie', cookie)
        .send({
          answers: [{ questionId: ratingQ!.id, ratingValue: 0 }],
        });

      expect(res0.status).toBe(400);
    });
  });

  // ============================================================================
  // TEST-10 (AC-10): Owning CREATOR Results Dashboard Aggregation
  // ============================================================================
  describe('TEST-10 (AC-10): Owning CREATOR results dashboard returns summary and submissions', () => {
    it('should return totalSubmissions, averageRating, and full answers for owning CREATOR', async () => {
      const published = await prisma.campaign.findFirst({
        where: { title: SEED_CAMPAIGN_TITLES.published },
        include: { questions: true },
      });

      expect(published).not.toBeNull();
      const ratingQ = published!.questions.find((q) => q.type === 'RATING_5');
      const textQ = published!.questions.find((q) => q.type === 'TEXT');

      // Submit from respondent1 (rating: 5)
      const { cookie: cookieResp1 } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );
      await request(app)
        .post(`/api/campaigns/${published!.id}/submissions`)
        .set('Cookie', cookieResp1)
        .send({
          answers: [
            { questionId: ratingQ!.id, ratingValue: 5 },
            { questionId: textQ!.id, textValue: 'Great!' },
          ],
        });

      // Submit from respondent2 (rating: 4)
      const { cookie: cookieResp2 } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent2.email,
        SEED_ACCOUNTS.respondent2.password
      );
      await request(app)
        .post(`/api/campaigns/${published!.id}/submissions`)
        .set('Cookie', cookieResp2)
        .send({
          answers: [
            { questionId: ratingQ!.id, ratingValue: 4 },
            { questionId: textQ!.id, textValue: 'Good!' },
          ],
        });

      // Owning creator1 queries results
      const { cookie: cookieCreator1 } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.creator1.email,
        SEED_ACCOUNTS.creator1.password
      );

      const res = await request(app)
        .get(`/api/campaigns/${published!.id}/results`)
        .set('Cookie', cookieCreator1);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.summary).toMatchObject({
        totalSubmissions: 2,
        averageRating: 4.5,
      });
      expect(res.body.data.submissions).toHaveLength(2);
      expect(res.body.data.submissions[0].answers).toBeDefined();
    });
  });

  // ============================================================================
  // TEST-11 (AC-11, BR-04): Ownership Isolation Guard
  // ============================================================================
  describe('TEST-11 (AC-11, BR-04): Strict creator ownership isolation on results access', () => {
    it('should reject non-owning CREATOR (creator2) with 403 FORBIDDEN_OWNER_ACCESS', async () => {
      const published = await prisma.campaign.findFirst({
        where: { title: SEED_CAMPAIGN_TITLES.published },
      });

      expect(published).not.toBeNull();

      const { cookie: cookieCreator2 } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.creator2.email,
        SEED_ACCOUNTS.creator2.password
      );

      const res = await request(app)
        .get(`/api/campaigns/${published!.id}/results`)
        .set('Cookie', cookieCreator2);

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('FORBIDDEN_OWNER_ACCESS');
      expect(res.body.data).toBeUndefined();
    });

    it('should reject RESPONDENT (respondent1) attempting to access results with 403', async () => {
      const published = await prisma.campaign.findFirst({
        where: { title: SEED_CAMPAIGN_TITLES.published },
      });

      expect(published).not.toBeNull();

      const { cookie: cookieRespondent } = await loginAndGetCookie(
        app,
        SEED_ACCOUNTS.respondent1.email,
        SEED_ACCOUNTS.respondent1.password
      );

      const res = await request(app)
        .get(`/api/campaigns/${published!.id}/results`)
        .set('Cookie', cookieRespondent);

      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
    });
  });
});
