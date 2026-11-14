import { PrismaClient, UserRole, CampaignStatus, QuestionType } from '@prisma/client';
import request from 'supertest';
import type { Express } from 'express';
import bcrypt from 'bcrypt';

// Test synthetic accounts per docs/sprints/sprint-1/contracts.md
export const SEED_ACCOUNTS = {
  creator1: {
    email: 'creator1@example.com',
    password: 'Password123!',
    role: UserRole.CREATOR,
    fullName: 'Alice Creator',
  },
  creator2: {
    email: 'creator2@example.com',
    password: 'Password123!',
    role: UserRole.CREATOR,
    fullName: 'Bob Creator',
  },
  respondent1: {
    email: 'respondent1@example.com',
    password: 'Password123!',
    role: UserRole.RESPONDENT,
    fullName: 'Charlie Respondent',
  },
  respondent2: {
    email: 'respondent2@example.com',
    password: 'Password123!',
    role: UserRole.RESPONDENT,
    fullName: 'Diana Respondent',
  },
};

export const SEED_CAMPAIGN_TITLES = {
  published: 'CPE 334 Course Experience Survey',
  closed: 'Archived Orientation Feedback',
};

// Determine database URL with safe fallback for test environment
function getDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  // If explicitly specified in environment, check if port 5433 fallback is needed
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432') && !process.env.DATABASE_URL.includes('127.0.0.1:5432')) {
    return process.env.DATABASE_URL;
  }
  // Default to mapped container on port 5433 for local testing without port collisions
  return 'postgresql://postgres:postgres@localhost:5433/pastelpulse?schema=public';
}

let testPrismaClient: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!testPrismaClient) {
    const url = getDatabaseUrl();
    testPrismaClient = new PrismaClient({
      datasources: {
        db: { url },
      },
    });
  }
  return testPrismaClient;
}

/**
 * Ensures the PostgreSQL database is reachable and seeded with the exact synthetic test accounts.
 */
export async function ensureDatabaseSeeded(): Promise<void> {
  const prisma = getTestPrisma();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    // If the primary URL failed and it was on 5432, attempt fallback to port 5433
    if (!process.env.TEST_DATABASE_URL) {
      testPrismaClient = new PrismaClient({
        datasources: {
          db: {
            url: 'postgresql://postgres:postgres@localhost:5433/pastelpulse?schema=public',
          },
        },
      });
      await testPrismaClient.$queryRaw`SELECT 1`;
    } else {
      throw error;
    }
  }

  const activePrisma = getTestPrisma();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Upsert the 4 synthetic test accounts
  for (const account of Object.values(SEED_ACCOUNTS)) {
    await activePrisma.user.upsert({
      where: { email: account.email },
      update: {
        passwordHash,
        fullName: account.fullName,
        role: account.role,
      },
      create: {
        email: account.email,
        passwordHash,
        fullName: account.fullName,
        role: account.role,
      },
    });
  }

  // Ensure published campaign exists
  const creator1 = await activePrisma.user.findUnique({
    where: { email: SEED_ACCOUNTS.creator1.email },
  });

  if (!creator1) {
    throw new Error('Seed creator1 not found in database');
  }

  let published = await activePrisma.campaign.findFirst({
    where: { creatorId: creator1.id, title: SEED_CAMPAIGN_TITLES.published },
    include: { questions: true },
  });

  if (!published) {
    published = await activePrisma.campaign.create({
      data: {
        creatorId: creator1.id,
        title: SEED_CAMPAIGN_TITLES.published,
        description: 'Please share your feedback on the CPE 334 course structure.',
        status: CampaignStatus.PUBLISHED,
        closesAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        questions: {
          create: [
            {
              prompt: 'Overall satisfaction with CPE 334',
              type: QuestionType.RATING_5,
              required: true,
              orderIndex: 0,
            },
            {
              prompt: 'What can we improve?',
              type: QuestionType.TEXT,
              required: false,
              orderIndex: 1,
            },
          ],
        },
      },
      include: { questions: true },
    });
  } else {
    // Ensure text question in published campaign has required: false
    await activePrisma.question.updateMany({
      where: {
        campaignId: published.id,
        type: QuestionType.TEXT,
      },
      data: {
        required: false,
      },
    });
  }

  // Ensure closed campaign exists
  let closed = await activePrisma.campaign.findFirst({
    where: { creatorId: creator1.id, title: SEED_CAMPAIGN_TITLES.closed },
  });

  if (!closed) {
    await activePrisma.campaign.create({
      data: {
        creatorId: creator1.id,
        title: SEED_CAMPAIGN_TITLES.closed,
        description: 'Historical feedback collection for freshman orientation.',
        status: CampaignStatus.CLOSED,
        closesAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        questions: {
          create: [
            {
              prompt: 'Overall rating of orientation activities',
              type: QuestionType.RATING_5,
              required: true,
              orderIndex: 0,
            },
            {
              prompt: 'Suggestions for future orientation sessions',
              type: QuestionType.TEXT,
              required: false,
              orderIndex: 1,
            },
          ],
        },
      },
    });
  }
}

/**
 * Cleans up newly created test records between test runs without deleting base seed accounts.
 */
export async function cleanupTestRecords(): Promise<void> {
  const prisma = getTestPrisma();

  try {
    // 1. Delete all answers
    await prisma.answer.deleteMany({});

    // 2. Delete all submissions
    await prisma.submission.deleteMany({});

    // 3. Delete non-seeded campaigns
    const seedTitles = Object.values(SEED_CAMPAIGN_TITLES);
    await prisma.campaign.deleteMany({
      where: {
        title: {
          notIn: seedTitles,
        },
      },
    });

    // 4. Delete non-seeded users
    const seedEmails = Object.values(SEED_ACCOUNTS).map((a) => a.email);
    await prisma.user.deleteMany({
      where: {
        email: {
          notIn: seedEmails,
        },
      },
    });
  } catch (err) {
    console.warn('⚠️ Warning during test cleanup:', err);
  }
}

/**
 * Helper to log in a user and extract the session cookie string.
 */
export async function loginAndGetCookie(
  app: Express,
  email: string,
  password: string
): Promise<{ cookie: string; response: request.Response }> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  const setCookie = response.headers['set-cookie'];
  let cookie = '';
  if (Array.isArray(setCookie)) {
    const sessionCookie = setCookie.find((c: string) => c.startsWith('pastelpulse_session='));
    if (sessionCookie) {
      cookie = sessionCookie.split(';')[0];
    }
  } else if (typeof setCookie === 'string' && setCookie.startsWith('pastelpulse_session=')) {
    cookie = setCookie.split(';')[0];
  }

  return { cookie, response };
}
