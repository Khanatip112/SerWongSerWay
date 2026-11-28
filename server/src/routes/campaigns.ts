import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  UserRole,
  CampaignStatus,
  QuestionType,
  SectionNextAction,
  ContentBlockType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { computeVisitedSections } from '../utils/sectionRouting.js';
import { validateAnswer } from '../utils/validation.js';
import { formatAnswer } from '../utils/formatAnswer.js';
import { QuestionConfig, QuestionData, SectionData } from '../types/survey.js';

const router = Router();

const RATING_TYPES: QuestionType[] = [
  QuestionType.RATING_5,
  QuestionType.RATING,
  QuestionType.LINEAR_SCALE,
];

// ============================================================================
// Payload schemas
// ============================================================================

const optionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    imageUrl: z.string().optional(),
    targetSectionId: z.string().optional(),
  })
  .passthrough();

const questionConfigSchema = z
  .object({
    options: z.array(optionSchema).optional(),
  })
  .passthrough();

const sectionSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, 'Section title is required'),
  description: z.string().nullable().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  nextAction: z.nativeEnum(SectionNextAction).optional().default(SectionNextAction.NEXT_SECTION),
  targetSectionId: z.string().nullable().optional(),
});

const questionSchema = z.object({
  id: z.string().min(1).optional(),
  sectionId: z.string().nullable().optional(),
  prompt: z.string().trim().min(1, 'Question prompt is required'),
  description: z.string().nullable().optional(),
  type: z.nativeEnum(QuestionType),
  required: z.boolean().optional().default(true),
  orderIndex: z.number().int().nonnegative().optional(),
  config: questionConfigSchema.optional(),
  image: z.record(z.unknown()).nullable().optional(),
});

const contentBlockSchema = z.object({
  id: z.string().min(1).optional(),
  sectionId: z.string().nullable().optional(),
  type: z.nativeEnum(ContentBlockType),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  config: z.record(z.unknown()).nullable().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
});

const campaignSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string().trim().optional().default(''),
    status: z.nativeEnum(CampaignStatus).optional().default(CampaignStatus.PUBLISHED),
    closesAt: z.string().datetime().nullable().optional(),
    sections: z.array(sectionSchema).optional().default([]),
    questions: z.array(questionSchema).optional().default([]),
    contentBlocks: z.array(contentBlockSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    // Drafts may be saved empty; publishing requires at least one question and a future closing deadline.
    if (data.status === CampaignStatus.PUBLISHED) {
      if (data.questions.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['questions'],
          message: 'At least one question is required to publish a campaign.',
        });
      }
      if (!data.closesAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['closesAt'],
          message: 'Closing deadline is required to publish a campaign.',
        });
      } else if (new Date(data.closesAt) <= new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['closesAt'],
          message: 'Closing deadline must be in the future.',
        });
      }
    }
  });

const submitAnswersSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      ratingValue: z.number().nullable().optional(),
      textValue: z.string().nullable().optional(),
      jsonValue: z.unknown().optional(),
    })
  ),
});

type CampaignPayload = z.infer<typeof campaignSchema>;
type QuestionPayload = z.infer<typeof questionSchema>;

// ============================================================================
// Shared helpers
// ============================================================================

const campaignDetailInclude = {
  sections: { orderBy: { orderIndex: 'asc' } },
  questions: { orderBy: { orderIndex: 'asc' } },
  contentBlocks: { orderBy: { orderIndex: 'asc' } },
} satisfies Prisma.CampaignInclude;

function sendCampaignValidationError(res: Response, error: z.ZodError): void {
  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid campaign payload.',
      details: error.errors,
    },
  });
}

function sectionCreateData(section: z.infer<typeof sectionSchema>, index: number) {
  return {
    id: section.id,
    title: section.title,
    description: section.description ?? null,
    orderIndex: section.orderIndex ?? index,
    nextAction: section.nextAction,
    targetSectionId: section.targetSectionId ?? null,
  };
}

function questionFields(question: QuestionPayload, index: number) {
  const config = (question.config ?? {}) as Prisma.InputJsonValue;

  return {
    sectionId: question.sectionId ?? null,
    prompt: question.prompt,
    description: question.description ?? null,
    type: question.type,
    required: question.required,
    orderIndex: question.orderIndex ?? index,
    config,
    ...(question.image === undefined
      ? {}
      : {
          image:
            question.image === null
              ? Prisma.JsonNull
              : (question.image as Prisma.InputJsonValue),
        }),
  };
}

function contentBlockFields(block: z.infer<typeof contentBlockSchema>, index: number) {
  return {
    sectionId: block.sectionId ?? null,
    type: block.type,
    title: block.title ?? null,
    description: block.description ?? null,
    config: (block.config ?? {}) as Prisma.InputJsonValue,
    orderIndex: block.orderIndex ?? index,
  };
}

// Client-generated IDs must be preserved so branch targets and submissions keep referring
// to the same sections, questions and blocks after a save.
function questionCreateData(question: QuestionPayload, index: number) {
  return {
    ...questionFields(question, index),
    ...(question.id ? { id: question.id } : {}),
  };
}

function contentBlockCreateData(block: z.infer<typeof contentBlockSchema>, index: number) {
  return {
    ...contentBlockFields(block, index),
    ...(block.id ? { id: block.id } : {}),
  };
}

function toQuestionData(question: {
  id: string;
  sectionId: string | null;
  prompt: string;
  description: string | null;
  type: QuestionType;
  required: boolean;
  orderIndex: number;
  config: Prisma.JsonValue;
  image: Prisma.JsonValue | null;
}): QuestionData {
  return {
    id: question.id,
    sectionId: question.sectionId,
    prompt: question.prompt,
    description: question.description,
    type: question.type as QuestionData['type'],
    required: question.required,
    orderIndex: question.orderIndex,
    config: (question.config ?? {}) as QuestionConfig,
    image: (question.image ?? null) as QuestionData['image'],
  };
}

function toSectionData(section: {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  nextAction: SectionNextAction;
  targetSectionId: string | null;
}): SectionData {
  return {
    id: section.id,
    title: section.title,
    description: section.description,
    orderIndex: section.orderIndex,
    nextAction: section.nextAction as SectionData['nextAction'],
    targetSectionId: section.targetSectionId,
  };
}

/**
 * Rewrites references to sections that were removed by an edit so branch targets never
 * point at a section that no longer exists.
 */
function cleanRemovedSectionReferences(
  payload: CampaignPayload,
  removedSectionIds: Set<string>
): CampaignPayload {
  const sections = payload.sections.map((section, index) => {
    if (section.targetSectionId && removedSectionIds.has(section.targetSectionId)) {
      return {
        ...section,
        orderIndex: section.orderIndex ?? index,
        nextAction: SectionNextAction.NEXT_SECTION,
        targetSectionId: null,
      };
    }
    return { ...section, orderIndex: section.orderIndex ?? index };
  });

  const questions = payload.questions.map((question, index) => {
    const config = { ...(question.config ?? {}) } as Record<string, unknown>;
    const options = Array.isArray(config.options)
      ? (config.options as Array<{ targetSectionId?: string }>)
      : undefined;
    const cleanOptions = options?.map((option) =>
      option.targetSectionId && removedSectionIds.has(option.targetSectionId)
        ? { ...option, targetSectionId: 'NEXT_SECTION' }
        : option
    );

    return {
      ...question,
      orderIndex: question.orderIndex ?? index,
      sectionId:
        question.sectionId && removedSectionIds.has(question.sectionId) ? null : question.sectionId ?? null,
      config: cleanOptions ? { ...config, options: cleanOptions } : config,
    };
  });

  const contentBlocks = payload.contentBlocks.map((block, index) => ({
    ...block,
    orderIndex: block.orderIndex ?? index,
    sectionId: block.sectionId && removedSectionIds.has(block.sectionId) ? null : block.sectionId ?? null,
  }));

  return { ...payload, sections, questions, contentBlocks };
}

// ============================================================================
// POST /api/campaigns (CREATOR only)
// ============================================================================
router.post(
  '/',
  requireAuth,
  requireRole([UserRole.CREATOR]),
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = campaignSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendCampaignValidationError(res, parseResult.error);
      return;
    }

    const { title, description, status, closesAt, sections, questions, contentBlocks } = parseResult.data;

    try {
      const campaign = await prisma.campaign.create({
        data: {
          creatorId: req.user!.id,
          title,
          description,
          status,
          closesAt: closesAt ? new Date(closesAt) : null,
          ...(sections.length ? { sections: { create: sections.map(sectionCreateData) } } : {}),
          ...(questions.length ? { questions: { create: questions.map(questionCreateData) } } : {}),
          ...(contentBlocks.length
            ? { contentBlocks: { create: contentBlocks.map(contentBlockCreateData) } }
            : {}),
        },
        include: campaignDetailInclude,
      });

      res.status(201).json({
        data: campaign,
      });
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create campaign.',
        },
      });
    }
  }
);

async function closeExpiredCampaigns(): Promise<void> {
  await prisma.campaign.updateMany({
    where: {
      status: CampaignStatus.PUBLISHED,
      closesAt: { lte: new Date() },
    },
    data: { status: CampaignStatus.CLOSED },
  });
}

// ============================================================================
// GET /api/campaigns (Authenticated: Role-scoped listing)
// ============================================================================
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  try {
    await closeExpiredCampaigns();

    if (user.role === UserRole.CREATOR) {
      const campaigns = await prisma.campaign.findMany({
        where: { creatorId: user.id },
        include: {
          questions: { orderBy: { orderIndex: 'asc' } },
          _count: { select: { submissions: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        data: campaigns,
      });
      return;
    }

    // Role is RESPONDENT: only active PUBLISHED campaigns annotated with hasSubmitted
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: CampaignStatus.PUBLISHED,
        OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }],
      },
      include: {
        creator: { select: { fullName: true } },
        questions: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const userSubmissions = await prisma.submission.findMany({
      where: {
        respondentId: user.id,
        campaignId: { in: campaigns.map((c) => c.id) },
      },
      select: { campaignId: true },
    });

    const submittedCampaignIds = new Set(userSubmissions.map((s) => s.campaignId));

    const annotatedCampaigns = campaigns.map((c) => ({
      ...c,
      hasSubmitted: submittedCampaignIds.has(c.id),
    }));

    res.status(200).json({
      data: annotatedCampaigns,
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve campaigns.',
      },
    });
  }
});

// ============================================================================
// GET /api/campaigns/:id (Authenticated: View single campaign)
// ============================================================================
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;

  try {
    await closeExpiredCampaigns();

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        ...campaignDetailInclude,
        creator: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!campaign) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found.',
        },
      });
      return;
    }

    if (user.role === UserRole.CREATOR && campaign.creatorId !== user.id) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: not campaign owner.',
        },
      });
      return;
    }

    if (user.role === UserRole.RESPONDENT && campaign.status !== CampaignStatus.PUBLISHED) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to non-published campaign.',
        },
      });
      return;
    }

    let hasSubmitted = false;
    let mySubmission: {
      id: string;
      submittedAt: Date;
      answers: Array<{
        questionId: string;
        questionPrompt: string;
        type: QuestionType | undefined;
        ratingValue: number | null;
        textValue: string | null;
        jsonValue: Prisma.JsonValue | null;
        formattedAnswer: string;
      }>;
    } | null = null;

    if (user.role === UserRole.RESPONDENT) {
      const existing = await prisma.submission.findUnique({
        where: {
          campaignId_respondentId: {
            campaignId: campaign.id,
            respondentId: user.id,
          },
        },
        include: {
          answers: true,
        },
      });
      hasSubmitted = !!existing;
      if (existing) {
        const questionMap = new Map(campaign.questions.map((q) => [q.id, toQuestionData(q)]));
        const sectionOrder = new Map(campaign.sections.map((s) => [s.id, s.orderIndex]));
        const answerSequence = new Map(
          campaign.questions.map((q) => [
            q.id,
            (q.sectionId ? sectionOrder.get(q.sectionId) ?? 0 : 0) * 10000 + q.orderIndex,
          ])
        );

        const sortedAnswers = [...existing.answers].sort(
          (a, b) => (answerSequence.get(a.questionId) ?? 0) - (answerSequence.get(b.questionId) ?? 0)
        );

        mySubmission = {
          id: existing.id,
          submittedAt: existing.submittedAt,
          answers: sortedAnswers.map((ans) => {
            const q = questionMap.get(ans.questionId);
            return {
              questionId: ans.questionId,
              questionPrompt: q?.prompt ?? '',
              type: q?.type as QuestionType | undefined,
              ratingValue: ans.ratingValue,
              textValue: ans.textValue,
              jsonValue: ans.jsonValue,
              formattedAnswer: q
                ? formatAnswer(q, {
                    ratingValue: ans.ratingValue,
                    textValue: ans.textValue,
                    jsonValue: ans.jsonValue,
                  })
                : ans.textValue ?? '',
            };
          }),
        };
      }
    }

    res.status(200).json({
      data: {
        ...campaign,
        hasSubmitted,
        mySubmission,
      },
    });
  } catch (error) {
    console.error('Error fetching campaign by id:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve campaign.',
      },
    });
  }
});

// ============================================================================
// PUT /api/campaigns/:id (CREATOR owner only: update a draft/published form)
// ============================================================================
router.put(
  '/:id',
  requireAuth,
  requireRole([UserRole.CREATOR]),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = req.user!;

    const parseResult = campaignSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendCampaignValidationError(res, parseResult.error);
      return;
    }

    try {
      const existing = await prisma.campaign.findUnique({
        where: { id },
        include: { sections: true, questions: true, contentBlocks: true },
      });

      if (!existing) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Campaign not found.' },
        });
        return;
      }

      if (existing.creatorId !== user.id) {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Access denied: not campaign owner.' },
        });
        return;
      }

      if (existing.status !== CampaignStatus.DRAFT) {
        res.status(409).json({
          error: {
            code: 'CAMPAIGN_NOT_EDITABLE',
            message: 'Only draft surveys can be edited.',
          },
        });
        return;
      }

      const existingSectionIds = new Set(existing.sections.map((section) => section.id));
      const existingQuestionIds = new Set(existing.questions.map((question) => question.id));
      const existingBlockIds = new Set(existing.contentBlocks.map((block) => block.id));

      const keepSectionIds = parseResult.data.sections
        .map((section) => section.id)
        .filter((sectionId): sectionId is string => !!sectionId && existingSectionIds.has(sectionId));
      const keepQuestionIds = parseResult.data.questions
        .map((question) => question.id)
        .filter((questionId): questionId is string => !!questionId && existingQuestionIds.has(questionId));
      const keepBlockIds = parseResult.data.contentBlocks
        .map((block) => block.id)
        .filter((blockId): blockId is string => !!blockId && existingBlockIds.has(blockId));

      const removedSectionIds = new Set(
        existing.sections
          .filter((section) => !keepSectionIds.includes(section.id))
          .map((section) => section.id)
      );

      const payload = cleanRemovedSectionReferences(parseResult.data, removedSectionIds);
      const { title, description, status, closesAt, sections, questions, contentBlocks } = payload;

      const campaign = await prisma.$transaction(async (tx) => {
        await tx.campaign.update({
          where: { id },
          data: {
            title,
            description,
            status,
            closesAt: closesAt ? new Date(closesAt) : null,
          },
        });

        await tx.section.deleteMany({
          where: { campaignId: id, id: { notIn: keepSectionIds } },
        });
        await tx.question.deleteMany({
          where: { campaignId: id, id: { notIn: keepQuestionIds } },
        });
        await tx.contentBlock.deleteMany({
          where: { campaignId: id, id: { notIn: keepBlockIds } },
        });

        for (const [index, section] of sections.entries()) {
          const fields = sectionCreateData(section, index);
          const { id: sectionId, ...sectionData } = fields;

          if (sectionId && existingSectionIds.has(sectionId)) {
            await tx.section.update({ where: { id: sectionId }, data: sectionData });
          } else {
            await tx.section.create({
              data: { ...sectionData, ...(sectionId ? { id: sectionId } : {}), campaignId: id },
            });
          }
        }

        for (const [index, question] of questions.entries()) {
          const fields = questionFields(question, index);

          if (question.id && existingQuestionIds.has(question.id)) {
            await tx.question.update({ where: { id: question.id }, data: fields });
          } else {
            await tx.question.create({
              data: { ...fields, ...(question.id ? { id: question.id } : {}), campaignId: id },
            });
          }
        }

        for (const [index, block] of contentBlocks.entries()) {
          const fields = contentBlockFields(block, index);

          if (block.id && existingBlockIds.has(block.id)) {
            await tx.contentBlock.update({ where: { id: block.id }, data: fields });
          } else {
            await tx.contentBlock.create({
              data: { ...fields, ...(block.id ? { id: block.id } : {}), campaignId: id },
            });
          }
        }

        return tx.campaign.findUniqueOrThrow({
          where: { id },
          include: campaignDetailInclude,
        });
      });

      res.status(200).json({ data: campaign });
    } catch (error) {
      console.error('Error updating campaign:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update campaign.',
        },
      });
    }
  }
);

// ============================================================================
// POST /api/campaigns/:id/submissions (RESPONDENT only)
// ============================================================================
router.post(
  '/:id/submissions',
  requireAuth,
  requireRole([UserRole.RESPONDENT]),
  async (req: Request, res: Response): Promise<void> => {
    const { id: campaignId } = req.params;
    const user = req.user!;

    // 1. Fetch target campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
        sections: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!campaign) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found.',
        },
      });
      return;
    }

    // 2. Enforce BR-02: Campaign must be open (PUBLISHED and not expired)
    const isPastDeadline = campaign.closesAt && new Date(campaign.closesAt) <= new Date();
    if (campaign.status !== CampaignStatus.PUBLISHED || isPastDeadline) {
      res.status(422).json({
        error: {
          code: 'CAMPAIGN_NOT_OPEN',
          message: 'Campaign is closed or not open for submissions.',
        },
      });
      return;
    }

    // 3. Enforce BR-01 application-level check: duplicate prevention
    const existingSubmission = await prisma.submission.findUnique({
      where: {
        campaignId_respondentId: {
          campaignId: campaign.id,
          respondentId: user.id,
        },
      },
    });

    if (existingSubmission) {
      res.status(409).json({
        error: {
          code: 'DUPLICATE_SUBMISSION',
          message: 'You have already submitted a response to this campaign.',
        },
      });
      return;
    }

    // 4. Validate payload format
    const parseResult = submitAnswersSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid answers format.',
          details: parseResult.error.errors,
        },
      });
      return;
    }

    const { answers } = parseResult.data;
    const questionMap = new Map(campaign.questions.map((question) => [question.id, toQuestionData(question)]));

    const unknownAnswer = answers.find((answer) => !questionMap.has(answer.questionId));
    if (unknownAnswer) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: `Question not found in this campaign: "${unknownAnswer.questionId}"`,
        },
      });
      return;
    }

    const answerMap: Record<
      string,
      { ratingValue?: number | null; textValue?: string | null; jsonValue?: unknown }
    > = {};
    for (const answer of answers) {
      answerMap[answer.questionId] = {
        ratingValue: answer.ratingValue ?? null,
        textValue: answer.textValue ?? null,
        jsonValue: answer.jsonValue,
      };
    }

    // 5. Enforce BR-03 through the shared validation rules, but only for questions in
    //    sections the respondent actually visited (conditional branching skips the rest).
    const questionData = campaign.questions.map(toQuestionData);
    const sectionData = campaign.sections.map(toSectionData);
    const { questionsToValidate } = computeVisitedSections(sectionData, questionData, answerMap);

    for (const question of questionsToValidate) {
      const validationError = validateAnswer(question, answerMap[question.id]);
      if (validationError) {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid answers.',
            details: [validationError],
          },
        });
        return;
      }
    }

    const validQuestionIds = new Set(questionsToValidate.map((question) => question.id));
    const answersToPersist = answers.filter((answer) => validQuestionIds.has(answer.questionId));

    // 6. Persist Submission and Answers atomically in PostgreSQL
    try {
      const submission = await prisma.$transaction(async (tx) => {
        return tx.submission.create({
          data: {
            campaignId: campaign.id,
            respondentId: user.id,
            answers: {
              create: answersToPersist.map((answer) => {
                const question = questionMap.get(answer.questionId)!;
                const ratingValue =
                  RATING_TYPES.includes(question.type) && typeof answer.ratingValue === 'number'
                    ? answer.ratingValue
                    : null;
                const jsonValue =
                  answer.jsonValue === undefined || answer.jsonValue === null
                    ? Prisma.JsonNull
                    : (answer.jsonValue as Prisma.InputJsonValue);

                return {
                  questionId: answer.questionId,
                  ratingValue,
                  textValue: answer.textValue ?? null,
                  jsonValue,
                };
              }),
            },
          },
        });
      });

      res.status(201).json({
        data: {
          submissionId: submission.id,
          campaignId: submission.campaignId,
          submittedAt: submission.submittedAt,
        },
      });
    } catch (error) {
      // Prisma P2002 represents Unique constraint failed
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        res.status(409).json({
          error: {
            code: 'DUPLICATE_SUBMISSION',
            message: 'You have already submitted a response to this campaign.',
          },
        });
        return;
      }

      console.error('Error saving submission:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to record survey submission.',
        },
      });
    }
  }
);

// ============================================================================
// GET /api/campaigns/:id/results (CREATOR owner only)
// ============================================================================
router.get(
  '/:id/results',
  requireAuth,
  requireRole([UserRole.CREATOR]),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = req.user!;

    try {
      await closeExpiredCampaigns();

      const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: {
          sections: { orderBy: { orderIndex: 'asc' } },
          questions: { orderBy: { orderIndex: 'asc' } },
        },
      });

      if (!campaign) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Campaign not found.',
          },
        });
        return;
      }

      // Enforce BR-04: Strict ownership check
      if (campaign.creatorId !== user.id) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN_OWNER_ACCESS',
            message: 'Only the campaign owner can access detailed results.',
          },
        });
        return;
      }

      // Order answers the way the respondent walked the form (section order, then question order).
      const sectionOrder = new Map(campaign.sections.map((section) => [section.id, section.orderIndex]));
      const answerSequence = new Map(
        campaign.questions.map((question) => [
          question.id,
          (question.sectionId ? sectionOrder.get(question.sectionId) ?? 0 : 0) * 10000 + question.orderIndex,
        ])
      );

      // Query submissions with respondent and answers
      const submissions = await prisma.submission.findMany({
        where: { campaignId: campaign.id },
        include: {
          respondent: {
            select: {
              fullName: true,
              email: true,
            },
          },
          answers: {
            include: {
              question: true,
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      });

      // Calculate total submissions and average rating
      let ratingSum = 0;
      let ratingCount = 0;

      const formattedSubmissions = submissions.map((sub) => {
        const sortedAnswers = [...sub.answers].sort(
          (a, b) => (answerSequence.get(a.questionId) ?? 0) - (answerSequence.get(b.questionId) ?? 0)
        );

        const answersFormatted = sortedAnswers.map((ans) => {
          if (
            ans.question.type === QuestionType.RATING_5 &&
            ans.ratingValue !== null &&
            ans.ratingValue !== undefined
          ) {
            ratingSum += ans.ratingValue;
            ratingCount++;
          }

          const question = toQuestionData(ans.question);

          return {
            questionId: ans.questionId,
            questionPrompt: ans.question.prompt,
            type: ans.question.type,
            ratingValue: ans.ratingValue,
            textValue: ans.textValue,
            jsonValue: ans.jsonValue,
            formattedAnswer: formatAnswer(question, {
              ratingValue: ans.ratingValue,
              textValue: ans.textValue,
              jsonValue: ans.jsonValue,
            }),
          };
        });

        return {
          id: sub.id,
          respondentName: sub.respondent.fullName,
          submittedAt: sub.submittedAt,
          answers: answersFormatted,
        };
      });

      const averageRating =
        ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;

      res.status(200).json({
        data: {
          campaign: {
            id: campaign.id,
            title: campaign.title,
            status: campaign.status,
          },
          summary: {
            totalSubmissions: submissions.length,
            averageRating,
          },
          submissions: formattedSubmissions,
        },
      });
    } catch (error) {
      console.error('Error fetching campaign results:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve campaign results.',
        },
      });
    }
  }
);

export default router;
