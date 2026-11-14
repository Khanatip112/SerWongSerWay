import { PrismaClient, UserRole, CampaignStatus, QuestionType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function main() {
  console.log('🌱 Starting database seeding...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Seed Synthetic Test Accounts
  const creator1 = await prisma.user.upsert({
    where: { email: 'creator1@example.com' },
    update: {
      passwordHash,
      fullName: 'Alice Creator',
      role: UserRole.CREATOR,
    },
    create: {
      email: 'creator1@example.com',
      passwordHash,
      fullName: 'Alice Creator',
      role: UserRole.CREATOR,
    },
  });

  const creator2 = await prisma.user.upsert({
    where: { email: 'creator2@example.com' },
    update: {
      passwordHash,
      fullName: 'Bob Creator',
      role: UserRole.CREATOR,
    },
    create: {
      email: 'creator2@example.com',
      passwordHash,
      fullName: 'Bob Creator',
      role: UserRole.CREATOR,
    },
  });

  const respondent1 = await prisma.user.upsert({
    where: { email: 'respondent1@example.com' },
    update: {
      passwordHash,
      fullName: 'Charlie Respondent',
      role: UserRole.RESPONDENT,
    },
    create: {
      email: 'respondent1@example.com',
      passwordHash,
      fullName: 'Charlie Respondent',
      role: UserRole.RESPONDENT,
    },
  });

  const respondent2 = await prisma.user.upsert({
    where: { email: 'respondent2@example.com' },
    update: {
      passwordHash,
      fullName: 'Diana Respondent',
      role: UserRole.RESPONDENT,
    },
    create: {
      email: 'respondent2@example.com',
      passwordHash,
      fullName: 'Diana Respondent',
      role: UserRole.RESPONDENT,
    },
  });

  console.log(`✓ Seeded users: ${creator1.email}, ${creator2.email}, ${respondent1.email}, ${respondent2.email}`);

  // 2. Seed Sample Campaigns owned by creator1@example.com
  // Sample 1: PUBLISHED Campaign
  const publishedTitle = 'CPE 334 Course Experience Survey';
  let publishedCampaign = await prisma.campaign.findFirst({
    where: { creatorId: creator1.id, title: publishedTitle },
  });

  if (!publishedCampaign) {
    publishedCampaign = await prisma.campaign.create({
      data: {
        creatorId: creator1.id,
        title: publishedTitle,
        description: 'Please share your feedback on the CPE 334 course structure, lectures, and lab assignments.',
        status: CampaignStatus.PUBLISHED,
        closesAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days in future
        questions: {
          create: [
            {
              prompt: 'Overall satisfaction with CPE 334',
              type: QuestionType.RATING_5,
              required: true,
              orderIndex: 0,
            },
            {
              prompt: 'What topics did you find most engaging or challenging?',
              type: QuestionType.TEXT,
              required: true,
              orderIndex: 1,
            },
          ],
        },
      },
    });
    console.log(`✓ Created PUBLISHED campaign: "${publishedCampaign.title}" (ID: ${publishedCampaign.id})`);
  } else {
    console.log(`ℹ PUBLISHED campaign already exists: "${publishedCampaign.title}" (ID: ${publishedCampaign.id})`);
  }

  // Sample 2: CLOSED Campaign
  const closedTitle = 'Archived Orientation Feedback';
  let closedCampaign = await prisma.campaign.findFirst({
    where: { creatorId: creator1.id, title: closedTitle },
  });

  if (!closedCampaign) {
    closedCampaign = await prisma.campaign.create({
      data: {
        creatorId: creator1.id,
        title: closedTitle,
        description: 'Historical feedback collection for the freshman engineering orientation.',
        status: CampaignStatus.CLOSED,
        closesAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Closed 7 days ago
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
    console.log(`✓ Created CLOSED campaign: "${closedCampaign.title}" (ID: ${closedCampaign.id})`);
  } else {
    console.log(`ℹ CLOSED campaign already exists: "${closedCampaign.title}" (ID: ${closedCampaign.id})`);
  }

  console.log('✅ Seeding completed successfully.');
}

if (process.env.NODE_ENV !== 'test') {
  main()
    .catch((e) => {
      console.error('❌ Error during seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
