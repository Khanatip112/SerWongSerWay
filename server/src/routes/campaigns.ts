import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UserRole, CampaignStatus, QuestionType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const createCampaignSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim(),
  closesAt: z.string().datetime().nullable().optional(),
  questions: z
    .array(
      z.object({
        prompt: z.string().trim().min(1, 'Question prompt is required'),
        type: z.nativeEnum(QuestionType),
        required: z.boolean().optional().default(true),
      })
    )
    .min(1, 'At least one question is required'),
});

const submitAnswersSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid().or(z.string().min(1)),
      ratingValue: z.number().optional().nullable(),
      textValue: z.string().optional().nullable(),
    })
  ),
});

// ============================================================================
// POST /api/campaigns (CREATOR only)
// ============================================================================
router.post(
  '/',
  requireAuth,
  requireRole([UserRole.CREATOR]),
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = createCampaignSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid campaign payload.',
          details: parseResult.error.errors,
        },
      });
      return;
    }

    const { title, description, closesAt, questions } = parseResult.data;

    try {
      const campaign = await prisma.$transaction(async (tx) => {
        return tx.campaign.create({
          data: {
            creatorId: req.user!.id,
            title,
            description,
            status: CampaignStatus.PUBLISHED,
            closesAt: closesAt ? new Date(closesAt) : null,
            questions: {
              create: questions.map((q, idx) => ({
                prompt: q.prompt,
                type: q.type,
                required: q.required,
                orderIndex: idx,
              })),
            },
          },
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        });
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

// ============================================================================
// GET /api/campaigns (Authenticated: Role-scoped listing)
// ============================================================================
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  try {
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

    // Role is RESPONDENT: only PUBLISHED campaigns annotated with hasSubmitted
    const campaigns = await prisma.campaign.findMany({
      where: { status: CampaignStatus.PUBLISHED },
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
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
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
    if (user.role === UserRole.RESPONDENT) {
      const existing = await prisma.submission.findUnique({
        where: {
          campaignId_respondentId: {
            campaignId: campaign.id,
            respondentId: user.id,
          },
        },
      });
      hasSubmitted = !!existing;
    }

    res.status(200).json({
      data: {
        ...campaign,
        hasSubmitted,
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
      include: { questions: true },
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
    const answerMap = new Map(answers.map((a) => [a.questionId, a]));

    // 5. Enforce BR-03: Required questions and rating values (1..5)
    for (const question of campaign.questions) {
      const answer = answerMap.get(question.id);

      if (question.required) {
        if (!answer) {
          res.status(400).json({
            error: {
              code: 'BAD_REQUEST',
              message: `Answer required for question: "${question.prompt}"`,
            },
          });
          return;
        }

        if (question.type === QuestionType.RATING_5) {
          if (answer.ratingValue === null || answer.ratingValue === undefined) {
            res.status(400).json({
              error: {
                code: 'BAD_REQUEST',
                message: `Rating score required for question: "${question.prompt}"`,
              },
            });
            return;
          }
        }

        if (question.type === QuestionType.TEXT) {
          if (!answer.textValue || answer.textValue.trim() === '') {
            res.status(400).json({
              error: {
                code: 'BAD_REQUEST',
                message: `Text feedback required for question: "${question.prompt}"`,
              },
            });
            return;
          }
        }
      }

      // Check rating boundary (1..5)
      if (answer && question.type === QuestionType.RATING_5) {
        if (answer.ratingValue !== null && answer.ratingValue !== undefined) {
          if (
            !Number.isInteger(answer.ratingValue) ||
            answer.ratingValue < 1 ||
            answer.ratingValue > 5
          ) {
            res.status(400).json({
              error: {
                code: 'BAD_REQUEST',
                message: 'Rating value must be an integer between 1 and 5 inclusive.',
              },
            });
            return;
          }
        }
      }
    }

    // 6. Persist Submission and Answers atomically in PostgreSQL
    try {
      const submission = await prisma.$transaction(async (tx) => {
        return tx.submission.create({
          data: {
            campaignId: campaign.id,
            respondentId: user.id,
            answers: {
              create: answers.map((ans) => {
                const q = campaign.questions.find((quest) => quest.id === ans.questionId);
                return {
                  questionId: ans.questionId,
                  ratingValue:
                    q?.type === QuestionType.RATING_5 ? ans.ratingValue ?? null : null,
                  textValue: q?.type === QuestionType.TEXT ? ans.textValue ?? null : null,
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
      const campaign = await prisma.campaign.findUnique({
        where: { id },
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
              question: {
                select: {
                  prompt: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      });

      // Calculate total submissions and average rating
      let ratingSum = 0;
      let ratingCount = 0;

      const formattedSubmissions = submissions.map((sub) => {
        const answersFormatted = sub.answers.map((ans) => {
          if (
            ans.question.type === QuestionType.RATING_5 &&
            ans.ratingValue !== null &&
            ans.ratingValue !== undefined
          ) {
            ratingSum += ans.ratingValue;
            ratingCount++;
          }

          return {
            questionPrompt: ans.question.prompt,
            type: ans.question.type,
            ratingValue: ans.ratingValue,
            textValue: ans.textValue,
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
