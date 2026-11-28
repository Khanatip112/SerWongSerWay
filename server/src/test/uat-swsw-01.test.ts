import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  getTestPrisma,
  ensureDatabaseSeeded,
  cleanupTestRecords,
  loginAndGetCookie,
  SEED_ACCOUNTS,
} from './helpers.js';

describe('UAT-SWSW-01 (AC-07, AC-10): Published campaign immutability & answer durability', () => {
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
      // Allow test assertions to proceed cleanly if DB is unavailable
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

  it('should reject PUT /api/campaigns/:id with 409 when campaign is PUBLISHED and preserve all persisted respondent answers', async () => {
    const { cookie: creatorCookie } = await loginAndGetCookie(
      app,
      SEED_ACCOUNTS.creator1.email,
      SEED_ACCOUNTS.creator1.password
    );
    expect(creatorCookie).not.toBe('');

    const futureClosesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Create a DRAFT campaign with 2 questions (RATING_5 and TEXT)
    const createRes = await request(app)
      .post('/api/campaigns')
      .set('Cookie', creatorCookie)
      .send({
        title: 'UAT-SWSW-01 Reproduction Survey',
        description: 'Verifies published surveys cannot be edited to wipe respondent answers.',
        status: 'DRAFT',
        closesAt: futureClosesAt,
        questions: [
          { prompt: 'Overall satisfaction', type: 'RATING_5', required: true },
          { prompt: 'What can we improve?', type: 'TEXT', required: true },
        ],
      });

    expect(createRes.status).toBe(201);
    const createdCampaign = createRes.body.data;
    const campaignId: string = createdCampaign.id;
    let questions: Array<{ id: string; prompt: string; type: string; required: boolean }> =
      createdCampaign.questions;

    expect(questions).toHaveLength(2);

    // 2. Publish the campaign if created as DRAFT
    if (createdCampaign.status === 'DRAFT') {
      const publishRes = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Cookie', creatorCookie)
        .send({
          title: createdCampaign.title,
          description: createdCampaign.description,
          status: 'PUBLISHED',
          closesAt: futureClosesAt,
          questions: questions.map((q, idx) => ({
            id: q.id,
            prompt: q.prompt,
            type: q.type,
            required: q.required,
            orderIndex: idx,
          })),
        });

      expect(publishRes.status).toBe(200);
      expect(publishRes.body.data.status).toBe('PUBLISHED');
      questions = publishRes.body.data.questions;
    }

    const q1 = questions.find((q) => q.type === 'RATING_5')!;
    const q2 = questions.find((q) => q.type === 'TEXT')!;
    expect(q1).toBeDefined();
    expect(q2).toBeDefined();

    // 3. Submit a respondent answer for both questions
    const { cookie: respondentCookie } = await loginAndGetCookie(
      app,
      SEED_ACCOUNTS.respondent1.email,
      SEED_ACCOUNTS.respondent1.password
    );
    expect(respondentCookie).not.toBe('');

    const submitRes = await request(app)
      .post(`/api/campaigns/${campaignId}/submissions`)
      .set('Cookie', respondentCookie)
      .send({
        answers: [
          { questionId: q1.id, ratingValue: 5 },
          { questionId: q2.id, textValue: 'Persisted UAT respondent feedback' },
        ],
      });

    expect(submitRes.status).toBe(201);

    // 4. Attempt to edit the PUBLISHED campaign by removing Question 2
    const editRes = await request(app)
      .put(`/api/campaigns/${campaignId}`)
      .set('Cookie', creatorCookie)
      .send({
        title: createdCampaign.title,
        description: createdCampaign.description,
        status: 'PUBLISHED',
        closesAt: futureClosesAt,
        questions: [
          {
            id: q1.id,
            prompt: q1.prompt,
            type: q1.type,
            required: q1.required,
            orderIndex: 0,
          },
        ],
      });

    // Must reject edits to non-DRAFT campaigns with 409 Conflict
    expect(editRes.status).toBe(409);
    expect(editRes.body.error).toBeDefined();
    expect(editRes.body.error.code).toBe('CAMPAIGN_NOT_EDITABLE');

    // 5. Verify /api/campaigns/:id/results still returns all persisted respondent answers intact
    const resultsRes = await request(app)
      .get(`/api/campaigns/${campaignId}/results`)
      .set('Cookie', creatorCookie);

    expect(resultsRes.status).toBe(200);
    expect(resultsRes.body.data.summary).toMatchObject({
      totalSubmissions: 1,
      averageRating: 5,
    });
    expect(resultsRes.body.data.submissions).toHaveLength(1);

    const answers = resultsRes.body.data.submissions[0].answers;
    expect(answers).toHaveLength(2);
    expect(answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questionPrompt: 'Overall satisfaction',
          type: 'RATING_5',
          ratingValue: 5,
        }),
        expect.objectContaining({
          questionPrompt: 'What can we improve?',
          type: 'TEXT',
          textValue: 'Persisted UAT respondent feedback',
        }),
      ])
    );
  });
});
