import { PrismaClient, Prisma, UserRole, CampaignStatus, QuestionType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function main() {
  console.log('🌱 Starting database seeding...');

  // ดึงรหัสผ่านแยกตามบัญชี (ใช้ SEED_DEFAULT_PASSWORD เป็นค่าสำรองเผื่อไว้ได้)
  const creator1Raw = process.env.CREATOR1_PASSWORD || process.env.SEED_DEFAULT_PASSWORD;
  const creator2Raw = process.env.CREATOR2_PASSWORD || process.env.SEED_DEFAULT_PASSWORD;
  const respondent1Raw = process.env.RESPONDENT1_PASSWORD || process.env.SEED_DEFAULT_PASSWORD;
  const respondent2Raw = process.env.RESPONDENT2_PASSWORD || process.env.SEED_DEFAULT_PASSWORD;

  if (!creator1Raw || !creator2Raw || !respondent1Raw || !respondent2Raw) {
    throw new Error('Missing password environment variables for seed accounts');
  }

  // เข้ารหัสแยกทีละบัญชี
  const creator1Hash = await bcrypt.hash(creator1Raw, 10);
  const creator2Hash = await bcrypt.hash(creator2Raw, 10);
  const respondent1Hash = await bcrypt.hash(respondent1Raw, 10);
  const respondent2Hash = await bcrypt.hash(respondent2Raw, 10);

  // 1. Seed Synthetic Test Accounts
  const creator1 = await prisma.user.upsert({
    where: { email: 'james.and@gmail.com' },
    update: {
      passwordHash: creator1Hash, // <-- เปลี่ยนตรงนี้
      fullName: 'James Anderson',
      role: UserRole.CREATOR,
    },
    create: {
      email: 'james.and@gmail.com',
      passwordHash: creator1Hash, // <-- เปลี่ยนตรงนี้
      fullName: 'James Anderson',
      role: UserRole.CREATOR,
    },
  });

  const creator2 = await prisma.user.upsert({
    where: { email: 'william.tho@gmail.com' },
    update: {
      passwordHash: creator2Hash, // <-- เปลี่ยนตรงนี้
      fullName: 'William Thompson',
      role: UserRole.CREATOR,
    },
    create: {
      email: 'william.tho@gmail.com',
      passwordHash: creator2Hash, // <-- เปลี่ยนตรงนี้
      fullName: 'William Thompson',
      role: UserRole.CREATOR,
    },
  });

  const respondent1 = await prisma.user.upsert({
    where: { email: 'amelia.cla@gmail.com' },
    update: {
      passwordHash: respondent1Hash, // <-- เปลี่ยนตรงนี้
      fullName: 'Amelia Clark',
      role: UserRole.RESPONDENT,
    },
    create: {
      email: 'amelia.cla@gmail.com',
      passwordHash: respondent1Hash, // <-- เปลี่ยนตรงนี้
      fullName: 'Amelia Clark',
      role: UserRole.RESPONDENT,
    },
  });

  const respondent2 = await prisma.user.upsert({
    where: { email: 'daniel.rob@gmail.com' },
    update: {
      passwordHash: respondent2Hash, // <-- เปลี่ยนตรงนี้
      fullName: 'Daniel Robinson',
      role: UserRole.RESPONDENT,
    },
    create: {
      email: 'daniel.rob@gmail.com',
      passwordHash: respondent2Hash, // <-- เปลี่ยนตรงนี้
      fullName: 'Daniel Robinson',
      role: UserRole.RESPONDENT,
    },
  });

  console.log(`✓ Seeded users: ${creator1.email}, ${creator2.email}, ${respondent1.email}, ${respondent2.email}`);

  // 2. Seed comprehensive sample campaigns.
  // Every demo campaign uses a deterministic UUID, so `npm run db:seed` can be re-run
  // safely: the existing seed campaigns (and everything cascading from them) are removed
  // first and then recreated with the same nested data.
  const seedUuid = (kind: number, campaign: number, index = 0): string =>
    `00000000-0000-4000-8${kind}00-${String(campaign).padStart(6, '0')}${String(index).padStart(6, '0')}`;

  const campaignUuid = (n: number): string => seedUuid(1, n);
  const sectionUuid = (n: number, i: number): string => seedUuid(2, n, i);
  const questionUuid = (n: number, i: number): string => seedUuid(3, n, i);
  const blockUuid = (n: number, i: number): string => seedUuid(4, n, i);
  const submissionUuid = (n: number, i: number): string => seedUuid(5, n, i);

  type SeedAnswer = {
    questionId: string;
    ratingValue?: number;
    textValue?: string;
    jsonValue?: unknown;
  };

  type SeedQuestion = {
    id: string;
    sectionId: string | null;
    prompt: string;
    description?: string;
    type: QuestionType;
    required: boolean;
    orderIndex: number;
    config?: Record<string, unknown>;
    image?: Record<string, unknown>;
  };

  type SeedSection = {
    id: string;
    title: string;
    description?: string;
    orderIndex: number;
    nextAction?: 'NEXT_SECTION' | 'GO_TO_SECTION' | 'SUBMIT_FORM';
    targetSectionId?: string | null;
  };

  type SeedBlock = {
    id: string;
    sectionId: string | null;
    type: 'TEXT_BLOCK' | 'IMAGE_BLOCK';
    title?: string;
    description?: string;
    config?: Record<string, unknown>;
    orderIndex: number;
  };

  type SeedSubmission = {
    id: string;
    respondentId: string;
    submittedAt: Date;
    answers: SeedAnswer[];
  };

  type SeedCampaign = {
    id: string;
    creatorId: string;
    title: string;
    description: string;
    status: CampaignStatus;
    closesAt: Date | null;
    createdAt: Date;
    sections: SeedSection[];
    questions: SeedQuestion[];
    contentBlocks: SeedBlock[];
    submissions: SeedSubmission[];
  };

  const futureClose = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const pastClose = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const campaigns: SeedCampaign[] = [
    // ------------------------------------------------------------------ DRAFTS
    {
      id: campaignUuid(1),
      creatorId: creator1.id,
      title: 'Q4 Student Club Budget Proposal',
      description:
        'Early outline for the Q4 student club budget request. Sections and questions will be added once the treasurer confirms the numbers.',
      status: CampaignStatus.DRAFT,
      closesAt: null,
      createdAt: new Date('2026-11-21T08:30:00.000Z'),
      sections: [],
      questions: [],
      contentBlocks: [],
      submissions: [],
    },
    {
      id: campaignUuid(2),
      creatorId: creator1.id,
      title: 'UX & Pastel Theme Usability Draft',
      description:
        'Internal draft used to validate the pastel design system before the survey is published to students.',
      status: CampaignStatus.DRAFT,
      closesAt: null,
      createdAt: new Date('2026-11-20T14:10:00.000Z'),
      sections: [
        {
          id: sectionUuid(2, 1),
          title: 'Design impressions',
          description: 'First reactions to the pastel palette and typography.',
          orderIndex: 0,
        },
      ],
      questions: [
        {
          id: questionUuid(2, 1),
          sectionId: sectionUuid(2, 1),
          prompt: 'How visually appealing is the pastel palette?',
          type: QuestionType.RATING_5,
          required: true,
          orderIndex: 0,
          config: { rating: { maxRating: 5, icon: 'STAR' } },
        },
        {
          id: questionUuid(2, 2),
          sectionId: sectionUuid(2, 1),
          prompt: 'Which accent colour works best?',
          type: QuestionType.MULTIPLE_CHOICE,
          required: true,
          orderIndex: 1,
          config: {
            options: [
              { id: 'opt-mint', label: 'Mint Breeze' },
              { id: 'opt-blush', label: 'Blush Petal' },
              { id: 'opt-lavender', label: 'Lavender Mist' },
              { id: 'opt-sky', label: 'Sky Haze' },
            ],
          },
        },
        {
          id: questionUuid(2, 3),
          sectionId: sectionUuid(2, 1),
          prompt: 'What would you change about the typography?',
          type: QuestionType.SHORT_ANSWER,
          required: true,
          orderIndex: 2,
          config: {},
        },
      ],
      contentBlocks: [
        {
          id: blockUuid(2, 1),
          sectionId: sectionUuid(2, 1),
          type: 'TEXT_BLOCK',
          title: 'Draft notice',
          description: 'This form is still a draft and is not visible to respondents.',
          orderIndex: 0,
        },
        {
          id: blockUuid(2, 2),
          sectionId: sectionUuid(2, 1),
          type: 'IMAGE_BLOCK',
          title: 'Palette exploration',
          config: {
            imageUrl: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=1200&q=80',
            alignment: 'center',
            caption: 'Pastel palette exploration shared with the design team.',
          },
          orderIndex: 1,
        },
      ],
      submissions: [],
    },
    {
      id: campaignUuid(3),
      creatorId: creator2.id,
      title: 'Faculty Workshop Schedule Draft',
      description:
        'Private draft owned by Creator 2 for collecting preferred workshop slots from faculty members.',
      status: CampaignStatus.DRAFT,
      closesAt: null,
      createdAt: new Date('2026-11-19T09:45:00.000Z'),
      sections: [
        {
          id: sectionUuid(3, 1),
          title: 'Workshop logistics',
          description: 'Availability and scheduling preferences for the faculty workshop.',
          orderIndex: 0,
        },
      ],
      questions: [
        {
          id: questionUuid(3, 1),
          sectionId: sectionUuid(3, 1),
          prompt: 'Which workshop slot works best for you?',
          type: QuestionType.DROPDOWN,
          required: true,
          orderIndex: 0,
          config: {
            options: [
              { id: 'opt-slot-mon-am', label: 'Monday 09:00 - 11:00' },
              { id: 'opt-slot-wed-pm', label: 'Wednesday 13:00 - 15:00' },
              { id: 'opt-slot-fri-am', label: 'Friday 09:00 - 11:00' },
            ],
          },
        },
        {
          id: questionUuid(3, 2),
          sectionId: sectionUuid(3, 1),
          prompt: 'Which date can you attend?',
          type: QuestionType.DATE,
          required: true,
          orderIndex: 1,
          config: { date: { includeYear: true, includeTime: false } },
        },
        {
          id: questionUuid(3, 3),
          sectionId: sectionUuid(3, 1),
          prompt: 'Is there anything we should account for when planning the session?',
          type: QuestionType.TEXT,
          required: false,
          orderIndex: 2,
          config: {},
        },
      ],
      contentBlocks: [],
      submissions: [],
    },

    // --------------------------------------------------------------- PUBLISHED
    {
      id: campaignUuid(4),
      creatorId: creator1.id,
      title: 'CPE 334 Course Experience Survey',
      description:
        'Please share your feedback on the CPE 334 course structure, lectures, and lab assignments.',
      status: CampaignStatus.PUBLISHED,
      closesAt: futureClose,
      createdAt: new Date('2026-11-02T09:00:00.000Z'),
      sections: [
        {
          id: sectionUuid(4, 1),
          title: 'Course overview',
          description: 'Your overall experience with CPE 334.',
          orderIndex: 0,
        },
        {
          id: sectionUuid(4, 2),
          title: 'Labs & assessment',
          description: 'Tell us about the practical side of the course.',
          orderIndex: 1,
        },
      ],
      questions: [
        {
          id: questionUuid(4, 1),
          sectionId: sectionUuid(4, 1),
          prompt: 'Overall satisfaction with CPE 334',
          type: QuestionType.RATING_5,
          required: true,
          orderIndex: 0,
          config: { rating: { maxRating: 5, icon: 'STAR' } },
        },
        {
          id: questionUuid(4, 2),
          sectionId: sectionUuid(4, 1),
          prompt: 'How would you describe the pace of the course?',
          type: QuestionType.MULTIPLE_CHOICE,
          required: false,
          orderIndex: 1,
          config: {
            options: [
              { id: 'opt-pace-slow', label: 'Too slow' },
              { id: 'opt-pace-balanced', label: 'About right' },
              { id: 'opt-pace-fast', label: 'Too fast' },
            ],
          },
        },
        {
          id: questionUuid(4, 3),
          sectionId: sectionUuid(4, 1),
          prompt: 'Which topics did you find most engaging?',
          type: QuestionType.CHECKBOXES,
          required: false,
          orderIndex: 2,
          config: {
            options: [
              { id: 'opt-topic-labs', label: 'Hands-on labs' },
              { id: 'opt-topic-projects', label: 'Team project' },
              { id: 'opt-topic-theory', label: 'Theory lectures' },
              { id: 'opt-topic-testing', label: 'Test-driven development' },
            ],
            checkboxValidation: { type: 'AT_LEAST', count: 1 },
          },
        },
        {
          id: questionUuid(4, 4),
          sectionId: sectionUuid(4, 1),
          prompt: 'What is one thing we could improve?',
          type: QuestionType.TEXT,
          required: false,
          orderIndex: 3,
          config: {
            textValidation: { category: 'LENGTH', operator: 'MAX_CHAR_COUNT', value: 500 },
          },
        },
        {
          id: questionUuid(4, 5),
          sectionId: sectionUuid(4, 2),
          prompt: 'How useful were the lab sessions?',
          type: QuestionType.LINEAR_SCALE,
          required: false,
          orderIndex: 4,
          config: {
            linearScale: {
              min: 1,
              max: 5,
              minLabel: 'Not useful',
              maxLabel: 'Very useful',
            },
          },
        },
      ],
      contentBlocks: [
        {
          id: blockUuid(4, 1),
          sectionId: sectionUuid(4, 1),
          type: 'TEXT_BLOCK',
          title: 'About this survey',
          description: 'This survey takes about three minutes and your answers are anonymous to classmates.',
          orderIndex: 0,
        },
      ],
      submissions: [
        {
          id: submissionUuid(4, 1),
          respondentId: respondent1.id,
          submittedAt: new Date('2026-11-18T10:15:00.000Z'),
          answers: [
            { questionId: questionUuid(4, 1), ratingValue: 5 },
            { questionId: questionUuid(4, 2), jsonValue: { selectedOptionId: 'opt-pace-balanced' } },
            {
              questionId: questionUuid(4, 3),
              jsonValue: ['opt-topic-labs', 'opt-topic-projects'],
            },
            {
              questionId: questionUuid(4, 4),
              textValue: 'More live coding demos in the lab sessions.',
            },
            { questionId: questionUuid(4, 5), ratingValue: 5 },
          ],
        },
        {
          id: submissionUuid(4, 2),
          respondentId: respondent2.id,
          submittedAt: new Date('2026-11-19T16:40:00.000Z'),
          answers: [
            { questionId: questionUuid(4, 1), ratingValue: 4 },
            { questionId: questionUuid(4, 2), jsonValue: { selectedOptionId: 'opt-pace-fast' } },
            { questionId: questionUuid(4, 3), jsonValue: ['opt-topic-theory'] },
            {
              questionId: questionUuid(4, 4),
              textValue: 'The assessment weighting could be explained earlier in the term.',
            },
            { questionId: questionUuid(4, 5), ratingValue: 4 },
          ],
        },
      ],
    },
    {
      id: campaignUuid(5),
      creatorId: creator1.id,
      title: 'Developer Tooling & Cloud Lab Readiness',
      description:
        'Help us size the cloud lab environment for next term by sharing your current tooling setup.',
      status: CampaignStatus.PUBLISHED,
      closesAt: futureClose,
      createdAt: new Date('2026-11-14T11:25:00.000Z'),
      sections: [
        {
          id: sectionUuid(5, 1),
          title: 'Environment snapshot',
          description: 'What you use today and where you get stuck.',
          orderIndex: 0,
        },
      ],
      questions: [
        {
          id: questionUuid(5, 1),
          sectionId: sectionUuid(5, 1),
          prompt: 'How ready is your current developer tooling for cloud labs?',
          type: QuestionType.RATING_5,
          required: true,
          orderIndex: 0,
          config: { rating: { maxRating: 5, icon: 'STAR' } },
        },
        {
          id: questionUuid(5, 2),
          sectionId: sectionUuid(5, 1),
          prompt: 'Which cloud provider does your team mainly use?',
          type: QuestionType.DROPDOWN,
          required: true,
          orderIndex: 1,
          config: {
            options: [
              { id: 'opt-cloud-aws', label: 'AWS' },
              { id: 'opt-cloud-gcp', label: 'Google Cloud' },
              { id: 'opt-cloud-azure', label: 'Azure' },
              { id: 'opt-cloud-onprem', label: 'On-premises only' },
            ],
          },
        },
        {
          id: questionUuid(5, 3),
          sectionId: sectionUuid(5, 1),
          prompt: 'Which tools do you use every day?',
          type: QuestionType.CHECKBOXES,
          required: false,
          orderIndex: 2,
          config: {
            options: [
              { id: 'opt-tool-vscode', label: 'VS Code' },
              { id: 'opt-tool-docker', label: 'Docker' },
              { id: 'opt-tool-k8s', label: 'Kubernetes' },
              { id: 'opt-tool-terraform', label: 'Terraform' },
              { id: 'opt-tool-actions', label: 'GitHub Actions' },
            ],
          },
        },
        {
          id: questionUuid(5, 4),
          sectionId: sectionUuid(5, 1),
          prompt: 'What is the biggest blocker when setting up a new environment?',
          type: QuestionType.SHORT_ANSWER,
          required: false,
          orderIndex: 3,
          config: {},
        },
        {
          id: questionUuid(5, 5),
          sectionId: sectionUuid(5, 1),
          prompt: 'Share your current setup notes (optional)',
          type: QuestionType.FILE_UPLOAD,
          required: false,
          orderIndex: 4,
          config: {
            fileUpload: {
              allowedTypesOnly: true,
              allowedTypes: ['Document', 'PDF'],
              maxFiles: 1,
              maxFileSizeMb: 10,
            },
          },
        },
      ],
      contentBlocks: [
        {
          id: blockUuid(5, 1),
          sectionId: sectionUuid(5, 1),
          type: 'TEXT_BLOCK',
          title: 'Why we ask',
          description: 'Your answers shape the image we pre-build for the cloud lab machines.',
          orderIndex: 0,
        },
      ],
      submissions: [],
    },
    {
      id: campaignUuid(6),
      creatorId: creator2.id,
      title: 'Campus Cafeteria & Food Delivery Feedback',
      description:
        'Tell us what is working in the campus cafeteria and where the delivery service should improve.',
      status: CampaignStatus.PUBLISHED,
      closesAt: futureClose,
      createdAt: new Date('2026-11-10T07:55:00.000Z'),
      sections: [
        {
          id: sectionUuid(6, 1),
          title: 'Dining experience',
          description: 'Your most recent visit to the campus cafeteria.',
          orderIndex: 0,
        },
        {
          id: sectionUuid(6, 2),
          title: 'Delivery & suggestions',
          description: 'Optional feedback about the delivery pilot.',
          orderIndex: 1,
        },
      ],
      questions: [
        {
          id: questionUuid(6, 1),
          sectionId: sectionUuid(6, 1),
          prompt: 'How would you rate the food quality?',
          type: QuestionType.RATING_5,
          required: true,
          orderIndex: 0,
          config: { rating: { maxRating: 5, icon: 'HEART' } },
        },
        {
          id: questionUuid(6, 2),
          sectionId: sectionUuid(6, 1),
          prompt: 'Which outlet do you visit most often?',
          type: QuestionType.MULTIPLE_CHOICE,
          required: true,
          orderIndex: 1,
          config: {
            options: [
              { id: 'opt-cafe-main', label: 'Main cafeteria' },
              { id: 'opt-cafe-west', label: 'West campus kiosk' },
              { id: 'opt-cafe-library', label: 'Library cafe' },
              { id: 'opt-cafe-offcampus', label: 'Off-campus instead' },
            ],
          },
        },
        {
          id: questionUuid(6, 3),
          sectionId: sectionUuid(6, 2),
          prompt: 'What influences your choice the most?',
          type: QuestionType.CHECKBOXES,
          required: false,
          orderIndex: 2,
          config: {
            options: [
              { id: 'opt-reason-taste', label: 'Taste' },
              { id: 'opt-reason-price', label: 'Price' },
              { id: 'opt-reason-speed', label: 'Speed of service' },
              { id: 'opt-reason-variety', label: 'Variety' },
            ],
          },
        },
        {
          id: questionUuid(6, 4),
          sectionId: sectionUuid(6, 2),
          prompt: 'What should the delivery pilot change?',
          type: QuestionType.TEXT,
          required: false,
          orderIndex: 3,
          config: {},
        },
      ],
      contentBlocks: [],
      submissions: [
        {
          id: submissionUuid(6, 1),
          respondentId: respondent1.id,
          submittedAt: new Date('2026-11-17T12:05:00.000Z'),
          answers: [
            { questionId: questionUuid(6, 1), ratingValue: 4 },
            { questionId: questionUuid(6, 2), jsonValue: { selectedOptionId: 'opt-cafe-west' } },
            {
              questionId: questionUuid(6, 3),
              jsonValue: ['opt-reason-taste', 'opt-reason-speed'],
            },
            {
              questionId: questionUuid(6, 4),
              textValue: 'The delivery window is too wide; a 20-minute estimate would help.',
            },
          ],
        },
      ],
    },
    {
      id: campaignUuid(7),
      creatorId: creator1.id,
      title: 'Annual Tech Conference & Track Registration',
      description:
        'Register for a conference track, tell us which workshops interest you, and review the sessions you attended.',
      status: CampaignStatus.PUBLISHED,
      closesAt: futureClose,
      createdAt: new Date('2026-11-06T13:00:00.000Z'),
      sections: [
        {
          id: sectionUuid(7, 1),
          title: 'Registration & track selection',
          description: 'Pick the track you plan to follow for the day.',
          orderIndex: 0,
          nextAction: 'NEXT_SECTION',
        },
        {
          id: sectionUuid(7, 2),
          title: 'Hands-on workshop preferences',
          description: 'Only shown to attendees who chose the Cloud & DevOps track.',
          orderIndex: 1,
          nextAction: 'NEXT_SECTION',
        },
        {
          id: sectionUuid(7, 3),
          title: 'Session feedback',
          description: 'Which sessions did you attend, and what should we change?',
          orderIndex: 2,
          nextAction: 'SUBMIT_FORM',
        },
      ],
      questions: [
        {
          id: questionUuid(7, 1),
          sectionId: sectionUuid(7, 1),
          prompt: 'Which track will you attend?',
          type: QuestionType.MULTIPLE_CHOICE,
          required: true,
          orderIndex: 0,
          config: {
            goToSectionBasedOnAnswer: true,
            options: [
              {
                id: 'opt-track-ai',
                label: 'AI & Machine Learning',
                targetSectionId: sectionUuid(7, 3),
              },
              {
                id: 'opt-track-cloud',
                label: 'Cloud & DevOps',
                targetSectionId: sectionUuid(7, 2),
              },
              {
                id: 'opt-track-keynote',
                label: 'Keynotes only',
                targetSectionId: 'SUBMIT_FORM',
              },
            ],
          },
        },
        {
          id: questionUuid(7, 2),
          sectionId: sectionUuid(7, 2),
          prompt: 'How interested are you in each workshop?',
          type: QuestionType.MULTIPLE_CHOICE_GRID,
          required: true,
          orderIndex: 1,
          config: {
            grid: {
              rows: [
                { id: 'row-k8s', label: 'Kubernetes deep dive' },
                { id: 'row-iac', label: 'Infrastructure as Code' },
                { id: 'row-observability', label: 'Observability' },
              ],
              columns: [
                { id: 'col-low', label: 'Low' },
                { id: 'col-medium', label: 'Medium' },
                { id: 'col-high', label: 'High' },
              ],
              requireEachRow: true,
              limitOnePerColumn: true,
            },
          },
        },
        {
          id: questionUuid(7, 3),
          sectionId: sectionUuid(7, 2),
          prompt: 'Which workshop should we add next year?',
          type: QuestionType.SHORT_ANSWER,
          required: false,
          orderIndex: 2,
          config: {},
        },
        {
          id: questionUuid(7, 4),
          sectionId: sectionUuid(7, 3),
          prompt: 'Which conference sessions did you attend?',
          type: QuestionType.CHECKBOX_GRID,
          required: true,
          orderIndex: 3,
          config: {
            grid: {
              rows: [
                { id: 'row-keynote', label: 'Opening keynote' },
                { id: 'row-ai-panel', label: 'AI research panel' },
                { id: 'row-hallway', label: 'Networking hallway track' },
              ],
              columns: [{ id: 'col-attended', label: 'Attended' }],
              requireEachRow: false,
            },
          },
        },
        {
          id: questionUuid(7, 5),
          sectionId: sectionUuid(7, 3),
          prompt: 'What should we change for next year?',
          type: QuestionType.TEXT,
          required: false,
          orderIndex: 4,
          config: {},
        },
      ],
      contentBlocks: [
        {
          id: blockUuid(7, 1),
          sectionId: sectionUuid(7, 1),
          type: 'TEXT_BLOCK',
          title: 'How track selection works',
          description:
            'Choose a track and the form will skip directly to the sessions that matter to you.',
          orderIndex: 0,
        },
      ],
      submissions: [
        {
          id: submissionUuid(7, 1),
          respondentId: respondent2.id,
          submittedAt: new Date('2026-11-22T09:30:00.000Z'),
          answers: [
            { questionId: questionUuid(7, 1), jsonValue: { selectedOptionId: 'opt-track-ai' } },
            {
              questionId: questionUuid(7, 4),
              jsonValue: {
                'row-keynote': ['col-attended'],
                'row-ai-panel': ['col-attended'],
              },
            },
            {
              questionId: questionUuid(7, 5),
              textValue: 'Add a second day for hands-on workshops.',
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------ CLOSED
    {
      id: campaignUuid(8),
      creatorId: creator1.id,
      title: 'Archived Orientation Feedback 2026',
      description:
        'Historical feedback collection for the 2026 freshman engineering orientation.',
      status: CampaignStatus.CLOSED,
      closesAt: pastClose,
      createdAt: new Date('2026-08-24T08:00:00.000Z'),
      sections: [
        {
          id: sectionUuid(8, 1),
          title: 'Orientation week',
          description: 'Reflections on the orientation programme.',
          orderIndex: 0,
        },
      ],
      questions: [
        {
          id: questionUuid(8, 1),
          sectionId: sectionUuid(8, 1),
          prompt: 'Overall rating of orientation activities',
          type: QuestionType.RATING_5,
          required: true,
          orderIndex: 0,
          config: { rating: { maxRating: 5, icon: 'STAR' } },
        },
        {
          id: questionUuid(8, 2),
          sectionId: sectionUuid(8, 1),
          prompt: 'Which part of orientation was most valuable?',
          type: QuestionType.MULTIPLE_CHOICE,
          required: true,
          orderIndex: 1,
          config: {
            options: [
              { id: 'opt-orient-tours', label: 'Campus tours' },
              { id: 'opt-orient-talks', label: 'Department talks' },
              { id: 'opt-orient-social', label: 'Social evening' },
            ],
          },
        },
        {
          id: questionUuid(8, 3),
          sectionId: sectionUuid(8, 1),
          prompt: 'Suggestions for future orientation sessions',
          type: QuestionType.TEXT,
          required: false,
          orderIndex: 2,
          config: {},
        },
      ],
      contentBlocks: [],
      submissions: [
        {
          id: submissionUuid(8, 1),
          respondentId: respondent1.id,
          submittedAt: new Date('2026-08-29T15:20:00.000Z'),
          answers: [
            { questionId: questionUuid(8, 1), ratingValue: 5 },
            { questionId: questionUuid(8, 2), jsonValue: { selectedOptionId: 'opt-orient-talks' } },
            { questionId: questionUuid(8, 3), textValue: 'The lab tours were the highlight.' },
          ],
        },
        {
          id: submissionUuid(8, 2),
          respondentId: respondent2.id,
          submittedAt: new Date('2026-08-30T10:00:00.000Z'),
          answers: [
            { questionId: questionUuid(8, 1), ratingValue: 4 },
            { questionId: questionUuid(8, 2), jsonValue: { selectedOptionId: 'opt-orient-social' } },
            { questionId: questionUuid(8, 3), textValue: 'More water stations next year.' },
          ],
        },
      ],
    },
    {
      id: campaignUuid(9),
      creatorId: creator2.id,
      title: 'Midterm Server Lab Infrastructure Evaluation',
      description:
        'Closed evaluation of the server lab environment used during midterm week.',
      status: CampaignStatus.CLOSED,
      closesAt: pastClose,
      createdAt: new Date('2026-10-28T10:30:00.000Z'),
      sections: [
        {
          id: sectionUuid(9, 1),
          title: 'Lab infrastructure',
          description: 'Reliability and remote access during the midterm window.',
          orderIndex: 0,
        },
      ],
      questions: [
        {
          id: questionUuid(9, 1),
          sectionId: sectionUuid(9, 1),
          prompt: 'How reliable was the midterm lab environment?',
          type: QuestionType.RATING_5,
          required: true,
          orderIndex: 0,
          config: { rating: { maxRating: 5, icon: 'STAR' } },
        },
        {
          id: questionUuid(9, 2),
          sectionId: sectionUuid(9, 1),
          prompt: 'Rate the remote access experience',
          type: QuestionType.LINEAR_SCALE,
          required: true,
          orderIndex: 1,
          config: {
            linearScale: {
              min: 1,
              max: 5,
              minLabel: 'Very poor',
              maxLabel: 'Excellent',
            },
          },
        },
        {
          id: questionUuid(9, 3),
          sectionId: sectionUuid(9, 1),
          prompt: 'Describe any infrastructure issues you hit during the midterm.',
          type: QuestionType.TEXT,
          required: false,
          orderIndex: 2,
          config: {},
        },
      ],
      contentBlocks: [],
      submissions: [
        {
          id: submissionUuid(9, 1),
          respondentId: respondent1.id,
          submittedAt: new Date('2026-11-01T18:45:00.000Z'),
          answers: [
            { questionId: questionUuid(9, 1), ratingValue: 3 },
            { questionId: questionUuid(9, 2), ratingValue: 4 },
            {
              questionId: questionUuid(9, 3),
              textValue: 'Remote access dropped twice during the exam window.',
            },
          ],
        },
      ],
    },
    {
      id: campaignUuid(10),
      creatorId: creator1.id,
      title: 'Cancelled Hackathon Interest Poll',
      description:
        'Interest poll for the cancelled winter hackathon. Kept for historical reference only.',
      status: CampaignStatus.CLOSED,
      closesAt: pastClose,
      createdAt: new Date('2026-09-15T09:10:00.000Z'),
      sections: [
        {
          id: sectionUuid(10, 1),
          title: 'Hackathon interest',
          description: 'Would you have joined the winter hackathon?',
          orderIndex: 0,
        },
      ],
      questions: [
        {
          id: questionUuid(10, 1),
          sectionId: sectionUuid(10, 1),
          prompt: 'Would you have joined the winter hackathon?',
          type: QuestionType.MULTIPLE_CHOICE,
          required: true,
          orderIndex: 0,
          config: {
            options: [
              { id: 'opt-hack-yes', label: 'Yes, definitely' },
              { id: 'opt-hack-maybe', label: 'Maybe, depending on the theme' },
              { id: 'opt-hack-no', label: 'No' },
            ],
          },
        },
        {
          id: questionUuid(10, 2),
          sectionId: sectionUuid(10, 1),
          prompt: 'What theme would have interested you?',
          type: QuestionType.TEXT,
          required: false,
          orderIndex: 1,
          config: {},
        },
      ],
      contentBlocks: [],
      submissions: [],
    },
  ];

  // Remove previous seed data (fixed IDs plus legacy seed titles) before recreating it.
  const legacySeedTitles = ['CPE 334 Course Experience Survey', 'Archived Orientation Feedback'];
  const removed = await prisma.campaign.deleteMany({
    where: {
      OR: [
        { id: { in: campaigns.map((seed) => seed.id) } },
        {
          creatorId: { in: [creator1.id, creator2.id] },
          title: { in: [...campaigns.map((seed) => seed.title), ...legacySeedTitles] },
        },
      ],
    },
  });
  console.log(`✓ Cleared ${removed.count} existing seed campaign(s) before re-seeding`);

  for (const seed of campaigns) {
    const { sections, questions, contentBlocks, submissions, ...campaign } = seed;

    await prisma.campaign.create({
      data: {
        ...campaign,
        ...(sections.length
          ? {
            sections: {
              create: sections.map((section) => ({
                ...section,
                description: section.description ?? null,
                nextAction: section.nextAction ?? 'NEXT_SECTION',
                targetSectionId: section.targetSectionId ?? null,
              })),
            },
          }
          : {}),
        ...(questions.length
          ? {
            questions: {
              create: questions.map((question) => ({
                ...question,
                config: (question.config ?? {}) as Prisma.InputJsonValue,
              })),
            },
          }
          : {}),
        ...(contentBlocks.length
          ? {
            contentBlocks: {
              create: contentBlocks.map((block) => ({
                ...block,
                title: block.title ?? null,
                description: block.description ?? null,
                config: (block.config ?? {}) as Prisma.InputJsonValue,
              })),
            },
          }
          : {}),
        ...(submissions.length
          ? {
            submissions: {
              create: submissions.map((submission) => ({
                id: submission.id,
                respondentId: submission.respondentId,
                submittedAt: submission.submittedAt,
                answers: { create: submission.answers },
              })),
            },
          }
          : {}),
      },
    });

    console.log(`✓ Seeded ${seed.status} campaign: "${seed.title}"`);
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
