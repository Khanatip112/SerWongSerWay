import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  cleanupTestRecords,
  ensureDatabaseSeeded,
  getTestPrisma,
  loginAndGetCookie,
  SEED_ACCOUNTS,
} from './helpers.js';
import {
  computeVisitedSections,
  cleanSectionReferencesOnDelete,
  popVisitedSection,
  pushVisitedSection,
  resolveNextSection,
} from '../utils/sectionRouting.js';
import { validateAnswer } from '../utils/validation.js';
import { formatAnswer } from '../utils/formatAnswer.js';
import { QuestionData, QuestionConfig, SectionData } from '../types/survey.js';

function makeSection(
  id: string,
  orderIndex: number,
  nextAction: SectionData['nextAction'] = 'NEXT_SECTION',
  targetSectionId: string | null = null
): SectionData {
  return {
    id,
    title: `Section ${orderIndex + 1}`,
    description: '',
    orderIndex,
    nextAction,
    targetSectionId,
  };
}

function makeQuestion(
  id: string,
  sectionId: string | null,
  type: QuestionData['type'] = 'MULTIPLE_CHOICE',
  config: QuestionConfig = {},
  required = true
): QuestionData {
  return {
    id,
    sectionId,
    prompt: `Question ${id}`,
    description: null,
    type,
    required,
    orderIndex: 0,
    config,
  };
}

const answers = (value: Record<string, unknown>) => value as Record<string, { jsonValue?: unknown; textValue?: string; ratingValue?: number }>;

describe('sectionRouting: answer-based branching', () => {
  const sections = [makeSection('s1', 0, 'SUBMIT_FORM'), makeSection('s2', 1), makeSection('s3', 2)];
  const branchQuestion = makeQuestion('q1', 's1', 'MULTIPLE_CHOICE', {
    goToSectionBasedOnAnswer: true,
    options: [
      { id: 'a', label: 'Go to three', targetSectionId: 's3' },
      { id: 'b', label: 'Submit now', targetSectionId: 'SUBMIT_FORM' },
    ],
  });

  it('lets a selected option destination override the section footer', () => {
    const result = resolveNextSection(sections[0], sections, [branchQuestion], answers({ q1: { jsonValue: { selectedOptionId: 'a' } } }));
    expect(result.action).toBe('GO_TO_SECTION');
    expect(result.targetSectionId).toBe('s3');
  });

  it('supports an option that submits the form', () => {
    const result = resolveNextSection(sections[0], sections, [branchQuestion], answers({ q1: { jsonValue: { selectedOptionId: 'b' } } }));
    expect(result.action).toBe('SUBMIT_FORM');
  });

  it('falls back to the section footer when no branch answer exists', () => {
    const result = resolveNextSection(sections[0], sections, [branchQuestion], answers({}));
    expect(result.action).toBe('SUBMIT_FORM');
  });

  it('follows the footer GO_TO_SECTION target', () => {
    const withTarget = [makeSection('s1', 0, 'GO_TO_SECTION', 's3'), sections[1], sections[2]];
    const result = resolveNextSection(withTarget[0], withTarget, [], answers({}));
    expect(result.targetSectionId).toBe('s3');
  });

  it('submits automatically from the last section', () => {
    const result = resolveNextSection(sections[2], sections, [], answers({}));
    expect(result.action).toBe('SUBMIT_FORM');
    expect(result.isLastSection).toBe(true);
  });
});

describe('sectionRouting: cycle protection and visited path', () => {
  it('breaks a cyclic section footer by advancing in order', () => {
    const sections = [
      makeSection('s1', 0, 'GO_TO_SECTION', 's2'),
      makeSection('s2', 1, 'GO_TO_SECTION', 's1'),
      makeSection('s3', 2),
    ];
    const result = resolveNextSection(sections[1], sections, [], answers({}), ['s1', 's2']);
    expect(result.action).toBe('GO_TO_SECTION');
    expect(result.targetSectionId).toBe('s3');
  });

  it('walks only visited sections and skips required questions in bypassed sections', () => {
    const sections = [
      makeSection('s1', 0),
      makeSection('s2', 1),
      makeSection('s3', 2),
    ];
    const branch = makeQuestion('q1', 's1', 'MULTIPLE_CHOICE', {
      goToSectionBasedOnAnswer: true,
      options: [{ id: 'skip', label: 'Skip', targetSectionId: 's3' }],
    });
    const skipped = makeQuestion('q2', 's2', 'SHORT_ANSWER');
    const final = makeQuestion('q3', 's3', 'SHORT_ANSWER');

    const result = computeVisitedSections(
      sections,
      [branch, skipped, final],
      answers({ q1: { jsonValue: { selectedOptionId: 'skip' } } })
    );

    expect(result.visitedSectionIds).toEqual(['s1', 's3']);
    expect(result.questionsToValidate.map((q) => q.id)).toEqual(['q1', 'q3']);
    expect(result.questionsToValidate.map((q) => q.id)).not.toContain('q2');
  });

  it('terminates when every section loops back', () => {
    const sections = [
      makeSection('s1', 0, 'GO_TO_SECTION', 's2'),
      makeSection('s2', 1, 'GO_TO_SECTION', 's1'),
    ];
    const result = computeVisitedSections(sections, [], answers({}));
    expect(result.visitedSectionIds.length).toBeLessThanOrEqual(sections.length);
  });

  it('maintains a LIFO back-navigation history stack', () => {
    let visited: string[] = [];
    visited = pushVisitedSection(visited, 's1');
    visited = pushVisitedSection(visited, 's2');

    const firstBack = popVisitedSection(visited);
    expect(firstBack.previousSectionId).toBe('s2');
    expect(firstBack.visited).toEqual(['s1']);

    const secondBack = popVisitedSection(firstBack.visited);
    expect(secondBack.previousSectionId).toBe('s1');
    expect(secondBack.visited).toEqual([]);

    const empty = popVisitedSection([]);
    expect(empty.previousSectionId).toBeNull();
  });
});

describe('sectionRouting: section deletion cleanup', () => {
  it('resets section footers and option destinations that referenced the deleted section', () => {
    const sections = [
      makeSection('s1', 0, 'GO_TO_SECTION', 'deleted'),
      makeSection('s2', 1, 'SUBMIT_FORM'),
    ];
    const question = makeQuestion('q1', 's1', 'DROPDOWN', {
      goToSectionBasedOnAnswer: true,
      options: [
        { id: 'a', label: 'A', targetSectionId: 'deleted' },
        { id: 'b', label: 'B', targetSectionId: 's2' },
      ],
    });

    const cleaned = cleanSectionReferencesOnDelete('deleted', sections, [question]);
    expect(cleaned.updatedSections[0].nextAction).toBe('NEXT_SECTION');
    expect(cleaned.updatedSections[0].targetSectionId).toBeNull();
    expect(cleaned.updatedQuestions[0].config?.options?.[0].targetSectionId).toBe('NEXT_SECTION');
    expect(cleaned.updatedQuestions[0].config?.options?.[1].targetSectionId).toBe('s2');
  });
});

describe('server validation: text, number and regex rules', () => {
  const shortAnswer = (config: QuestionConfig) =>
    makeQuestion('q', null, 'SHORT_ANSWER', config);

  it('validates numeric bounds and whole numbers', () => {
    const gt = shortAnswer({ textValidation: { category: 'NUMBER', operator: 'GT', value: 10 } });
    expect(validateAnswer(gt, { textValue: '11' })).toBeNull();
    expect(validateAnswer(gt, { textValue: '10' })?.message).toContain('greater than 10');

    const whole = shortAnswer({ textValidation: { category: 'NUMBER', operator: 'WHOLE_NUMBER' } });
    expect(validateAnswer(whole, { textValue: '2.5' })?.message).toContain('whole number');
    expect(validateAnswer(whole, { textValue: '3' })).toBeNull();
  });

  it('supports between, not-between and equality rules', () => {
    const between = shortAnswer({ textValidation: { category: 'NUMBER', operator: 'BETWEEN', value: 1, secondValue: 5 } });
    expect(validateAnswer(between, { textValue: '3' })).toBeNull();
    expect(validateAnswer(between, { textValue: '6' })).not.toBeNull();

    const eq = shortAnswer({ textValidation: { category: 'NUMBER', operator: 'EQ', value: 7 } });
    expect(validateAnswer(eq, { textValue: '7' })).toBeNull();
    expect(validateAnswer(eq, { textValue: '8' })).not.toBeNull();
  });

  it('validates text, email, url and length rules', () => {
    const email = shortAnswer({ textValidation: { category: 'TEXT', operator: 'EMAIL' } });
    expect(validateAnswer(email, { textValue: 'user@example.com' })).toBeNull();
    expect(validateAnswer(email, { textValue: 'not-an-email' })).not.toBeNull();

    const url = shortAnswer({ textValidation: { category: 'TEXT', operator: 'URL' } });
    expect(validateAnswer(url, { textValue: 'https://example.com' })).toBeNull();
    expect(validateAnswer(url, { textValue: 'example.com' })).not.toBeNull();

    const length = makeQuestion('q', null, 'PARAGRAPH', {
      textValidation: { category: 'LENGTH', operator: 'MAX_CHAR_COUNT', value: 5 },
    });
    expect(validateAnswer(length, { textValue: '12345' })).toBeNull();
    expect(validateAnswer(length, { textValue: '123456' })?.message).toContain('at most 5');
  });

  it('validates regular expressions, including custom error text', () => {
    const matches = shortAnswer({
      textValidation: { category: 'REGEX', operator: 'MATCHES', value: '[A-Z]{3}', errorText: 'Use three capitals' },
    });
    expect(validateAnswer(matches, { textValue: 'ABC' })).toBeNull();
    expect(validateAnswer(matches, { textValue: 'abcd' })?.message).toBe('Use three capitals');

    const contains = shortAnswer({ textValidation: { category: 'REGEX', operator: 'CONTAINS', value: '\\d{3}' } });
    expect(validateAnswer(contains, { textValue: 'abc123' })).toBeNull();
    expect(validateAnswer(contains, { textValue: 'abc' })).not.toBeNull();
  });
});

describe('server validation: checkboxes, grids and files', () => {
  it('enforces at-least, at-most and exactly selection counts', () => {
    const atLeast = makeQuestion('q', null, 'CHECKBOXES', {
      checkboxValidation: { type: 'AT_LEAST', count: 2 },
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
    });
    expect(validateAnswer(atLeast, { jsonValue: ['a'] })?.message).toContain('at least 2');
    expect(validateAnswer(atLeast, { jsonValue: ['a', 'b'] })).toBeNull();

    const atMost = makeQuestion('q', null, 'CHECKBOXES', {
      checkboxValidation: { type: 'AT_MOST', count: 1 },
    });
    expect(validateAnswer(atMost, { jsonValue: ['a', 'b'] })?.message).toContain('at most 1');

    const exactly = makeQuestion('q', null, 'CHECKBOXES', {
      checkboxValidation: { type: 'EXACTLY', count: 2 },
    });
    expect(validateAnswer(exactly, { jsonValue: ['a'] })?.message).toContain('exactly 2');
    expect(validateAnswer(exactly, { jsonValue: ['a', 'b'] })).toBeNull();
  });

  it('requires "Other" free text when the Other option is selected', () => {
    const other = makeQuestion('q', null, 'MULTIPLE_CHOICE', {
      hasOtherOption: true,
      options: [{ id: 'a', label: 'A' }],
    });
    expect(validateAnswer(other, { jsonValue: { selectedOptionId: 'OTHER', otherText: '' } })).not.toBeNull();
    expect(validateAnswer(other, { jsonValue: { selectedOptionId: 'OTHER', otherText: 'Custom' } })).toBeNull();
  });

  it('enforces one response per column in both grid types', () => {
    const gridConfig = {
      grid: {
        rows: [{ id: 'r1', label: 'Row 1' }, { id: 'r2', label: 'Row 2' }],
        columns: [{ id: 'c1', label: 'Col 1' }, { id: 'c2', label: 'Col 2' }],
        limitOnePerColumn: true,
      },
    };
    const mcGrid = makeQuestion('q', null, 'MULTIPLE_CHOICE_GRID', gridConfig);
    expect(validateAnswer(mcGrid, { jsonValue: { r1: 'c1', r2: 'c1' } })?.message).toContain('per column');
    expect(validateAnswer(mcGrid, { jsonValue: { r1: 'c1', r2: 'c2' } })).toBeNull();

    const checkboxGrid = makeQuestion('q', null, 'CHECKBOX_GRID', gridConfig);
    expect(validateAnswer(checkboxGrid, { jsonValue: { r1: ['c1'], r2: ['c1'] } })?.message).toContain('per column');
    expect(validateAnswer(checkboxGrid, { jsonValue: { r1: ['c1'], r2: ['c2'] } })).toBeNull();
  });

  it('enforces require-each-row and required-at-least-one-row semantics', () => {
    const requireEach = makeQuestion('q', null, 'MULTIPLE_CHOICE_GRID', {
      grid: {
        rows: [{ id: 'r1', label: 'Row 1' }, { id: 'r2', label: 'Row 2' }],
        columns: [{ id: 'c1', label: 'Col 1' }],
        requireEachRow: true,
      },
    });
    expect(validateAnswer(requireEach, { jsonValue: { r1: 'c1' } })?.message).toContain('per row');

    const required = makeQuestion('q', null, 'MULTIPLE_CHOICE_GRID', {
      grid: { rows: [{ id: 'r1', label: 'Row 1' }], columns: [{ id: 'c1', label: 'Col 1' }] },
    });
    expect(validateAnswer(required, { jsonValue: {} })).not.toBeNull();
    expect(validateAnswer(required, { jsonValue: { r1: 'c1' } })).toBeNull();
  });

  it('enforces file count, size and allowed MIME/extension rules', () => {
    const upload = makeQuestion('q', null, 'FILE_UPLOAD', {
      fileUpload: { allowedTypesOnly: true, allowedTypes: ['PDF'], maxFiles: 1, maxFileSizeMb: 1 },
    });

    expect(validateAnswer(upload, { jsonValue: [] })).not.toBeNull();
    expect(
      validateAnswer(upload, { jsonValue: [{ name: 'notes.txt', size: 10, type: 'text/plain' }] })?.message
    ).toContain('not an allowed file type');
    expect(
      validateAnswer(upload, { jsonValue: [{ name: 'paper.pdf', size: 2 * 1024 * 1024, type: 'application/pdf' }] })?.message
    ).toContain('exceeds maximum size');
    expect(validateAnswer(upload, { jsonValue: [{ name: 'paper.pdf', size: 1024, type: 'application/pdf' }] })).toBeNull();
    expect(
      validateAnswer(upload, {
        jsonValue: [
          { name: 'a.pdf', size: 10, type: 'application/pdf' },
          { name: 'b.pdf', size: 10, type: 'application/pdf' },
        ],
      })?.message
    ).toContain('Maximum 1');
  });
});

describe('server validation: legacy compatibility and date/time', () => {
  it('keeps RATING_5 answers constrained to 1..5', () => {
    const rating = makeQuestion('q', null, 'RATING_5');
    expect(validateAnswer(rating, { ratingValue: 0 })).not.toBeNull();
    expect(validateAnswer(rating, { ratingValue: 6 })).not.toBeNull();
    expect(validateAnswer(rating, { ratingValue: 5 })).toBeNull();
  });

  it('accepts TEXT answers exactly as Sprint 1 did', () => {
    const text = makeQuestion('q', null, 'TEXT', {}, true);
    expect(validateAnswer(text, { textValue: '  ' })).not.toBeNull();
    expect(validateAnswer(text, { textValue: 'Great course' })).toBeNull();
  });

  it('validates MM-DD and duration formats', () => {
    const date = makeQuestion('q', null, 'DATE', { date: { includeYear: false } });
    expect(validateAnswer(date, { textValue: '12-25' })).toBeNull();
    expect(validateAnswer(date, { textValue: '2026-12-25' })).not.toBeNull();

    const duration = makeQuestion('q', null, 'TIME', { time: { mode: 'DURATION' } });
    expect(validateAnswer(duration, { textValue: '01:30:00' })).toBeNull();
    expect(validateAnswer(duration, { textValue: '01:30' })).not.toBeNull();
  });
});

describe('results formatting', () => {
  it('resolves option labels, grids, files and ratings to readable text', () => {
    const choice = makeQuestion('q', null, 'MULTIPLE_CHOICE', {
      options: [{ id: 'a', label: 'Excellent' }, { id: 'b', label: 'Poor' }],
    });
    expect(formatAnswer(choice, { jsonValue: { selectedOptionId: 'a' } })).toBe('Excellent');
    expect(formatAnswer(choice, { jsonValue: { selectedOptionId: 'OTHER', otherText: 'Custom' } })).toBe('Other: Custom');

    const grid = makeQuestion('q', null, 'MULTIPLE_CHOICE_GRID', {
      grid: {
        rows: [{ id: 'r1', label: 'Speed' }],
        columns: [{ id: 'c1', label: 'Good' }],
      },
    });
    expect(formatAnswer(grid, { jsonValue: { r1: 'c1' } })).toBe('Speed: Good');

    const upload = makeQuestion('q', null, 'FILE_UPLOAD');
    expect(formatAnswer(upload, { jsonValue: [{ name: 'a.pdf', size: 1, type: 'application/pdf' }] })).toBe('a.pdf');

    const rating = makeQuestion('q', null, 'RATING', { rating: { maxRating: 5, icon: 'HEART' } });
    expect(formatAnswer(rating, { ratingValue: 4 })).toBe('4 / 5 ♥');
  });
});

describe('API: draft, branching submission and grid validation', () => {
  const app = createApp();
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await ensureDatabaseSeeded();
  });

  beforeEach(async () => {
    await cleanupTestRecords();
  });

  afterAll(async () => {
    await cleanupTestRecords();
    await prisma.$disconnect();
  });

  const creatorCookie = async () =>
    (await loginAndGetCookie(app, SEED_ACCOUNTS.creator1.email, SEED_ACCOUNTS.creator1.password)).cookie;

  const respondentCookie = async () =>
    (await loginAndGetCookie(app, SEED_ACCOUNTS.respondent2.email, SEED_ACCOUNTS.respondent2.password)).cookie;

  it('saves an empty DRAFT but rejects publishing a form with no questions', async () => {
    const cookie = await creatorCookie();

    const draft = await request(app)
      .post('/api/campaigns')
      .set('Cookie', cookie)
      .send({ title: 'Empty draft form', description: '', status: 'DRAFT', questions: [] });

    expect(draft.status).toBe(201);
    expect(draft.body.data.status).toBe('DRAFT');
    expect(draft.body.data.questions).toEqual([]);

    const publish = await request(app)
      .post('/api/campaigns')
      .set('Cookie', cookie)
      .send({ title: 'Empty published form', description: '', status: 'PUBLISHED', questions: [] });

    expect(publish.status).toBe(400);
  });

  it('skips required questions in bypassed sections and formats branch answers', async () => {
    const creator = await creatorCookie();
    const s1 = randomUUID();
    const s2 = randomUUID();
    const s3 = randomUUID();
    const q1 = randomUUID();
    const q2 = randomUUID();
    const q3 = randomUUID();

    const created = await request(app)
      .post('/api/campaigns')
      .set('Cookie', creator)
      .send({
        title: 'Branching API Survey',
        description: 'Conditional routing coverage',
        status: 'PUBLISHED',
        sections: [
          { id: s1, title: 'Start', orderIndex: 0, nextAction: 'NEXT_SECTION' },
          { id: s2, title: 'Skipped', orderIndex: 1, nextAction: 'NEXT_SECTION' },
          { id: s3, title: 'Finish', orderIndex: 2, nextAction: 'SUBMIT_FORM' },
        ],
        questions: [
          {
            id: q1,
            sectionId: s1,
            prompt: 'Choose a path',
            type: 'MULTIPLE_CHOICE',
            required: true,
            orderIndex: 0,
            config: {
              goToSectionBasedOnAnswer: true,
              options: [
                { id: 'opt_skip', label: 'Skip ahead', targetSectionId: s3 },
                { id: 'opt_stay', label: 'Continue', targetSectionId: 'NEXT_SECTION' },
              ],
            },
          },
          {
            id: q2,
            sectionId: s2,
            prompt: 'Skipped required question',
            type: 'SHORT_ANSWER',
            required: true,
            orderIndex: 0,
          },
          {
            id: q3,
            sectionId: s3,
            prompt: 'Final comment',
            type: 'SHORT_ANSWER',
            required: false,
            orderIndex: 0,
          },
        ],
      });

    expect(created.status).toBe(201);
    expect(created.body.data.sections).toHaveLength(3);

    const respondent = await respondentCookie();
    const submission = await request(app)
      .post(`/api/campaigns/${created.body.data.id}/submissions`)
      .set('Cookie', respondent)
      .send({
        answers: [
          { questionId: q1, jsonValue: { selectedOptionId: 'opt_skip' } },
          { questionId: q3, textValue: 'Finished without the skipped section' },
        ],
      });

    expect(submission.status).toBe(201);

    const results = await request(app)
      .get(`/api/campaigns/${created.body.data.id}/results`)
      .set('Cookie', creator);

    expect(results.status).toBe(200);
    expect(results.body.data.summary.totalSubmissions).toBe(1);
    expect(results.body.data.submissions[0].answers[0].formattedAnswer).toBe('Skip ahead');
    // Answers from the bypassed section are not persisted.
    expect(results.body.data.submissions[0].answers).toHaveLength(2);
  });

  it('preserves stable section IDs on edit and cleans branch targets when a section is removed', async () => {
    const cookie = await creatorCookie();
    const s1 = randomUUID();
    const s2 = randomUUID();
    const q1 = randomUUID();

    const created = await request(app)
      .post('/api/campaigns')
      .set('Cookie', cookie)
      .send({
        title: 'Editable Branching Form',
        description: '',
        status: 'DRAFT',
        sections: [
          { id: s1, title: 'First', orderIndex: 0, nextAction: 'NEXT_SECTION' },
          { id: s2, title: 'Second', orderIndex: 1, nextAction: 'SUBMIT_FORM' },
        ],
        questions: [
          {
            id: q1,
            sectionId: s1,
            prompt: 'Pick a route',
            type: 'DROPDOWN',
            required: false,
            orderIndex: 0,
            config: {
              goToSectionBasedOnAnswer: true,
              options: [{ id: 'route_second', label: 'Go second', targetSectionId: s2 }],
            },
          },
        ],
      });

    expect(created.status).toBe(201);

    const updated = await request(app)
      .put(`/api/campaigns/${created.body.data.id}`)
      .set('Cookie', cookie)
      .send({
        title: 'Editable Branching Form v2',
        description: '',
        status: 'DRAFT',
        sections: [{ id: s1, title: 'First', orderIndex: 0, nextAction: 'NEXT_SECTION' }],
        questions: [
          {
            id: q1,
            sectionId: s1,
            prompt: 'Pick a route',
            type: 'DROPDOWN',
            required: false,
            orderIndex: 0,
            config: {
              goToSectionBasedOnAnswer: true,
              options: [{ id: 'route_second', label: 'Go second', targetSectionId: s2 }],
            },
          },
        ],
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('Editable Branching Form v2');
    expect(updated.body.data.sections.map((section: { id: string }) => section.id)).toEqual([s1]);
    expect(updated.body.data.questions[0].id).toBe(q1);
    // The removed section's ID must not survive as a branch destination.
    expect(updated.body.data.questions[0].config.options[0].targetSectionId).toBe('NEXT_SECTION');
  });

  it('rejects a grid answer that reuses a column when one-per-column is enabled', async () => {
    const creator = await creatorCookie();
    const q1 = randomUUID();

    const created = await request(app)
      .post('/api/campaigns')
      .set('Cookie', creator)
      .send({
        title: 'Grid Rule Survey',
        description: 'One column per grid',
        status: 'PUBLISHED',
        questions: [
          {
            id: q1,
            prompt: 'Rate the sessions',
            type: 'MULTIPLE_CHOICE_GRID',
            required: true,
            orderIndex: 0,
            config: {
              grid: {
                rows: [{ id: 'r1', label: 'Session 1' }, { id: 'r2', label: 'Session 2' }],
                columns: [{ id: 'c1', label: 'Good' }, { id: 'c2', label: 'Bad' }],
                limitOnePerColumn: true,
              },
            },
          },
        ],
      });

    expect(created.status).toBe(201);
    const respondent = await respondentCookie();

    const invalid = await request(app)
      .post(`/api/campaigns/${created.body.data.id}/submissions`)
      .set('Cookie', respondent)
      .send({ answers: [{ questionId: q1, jsonValue: { r1: 'c1', r2: 'c1' } }] });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details[0].message).toContain('per column');

    const valid = await request(app)
      .post(`/api/campaigns/${created.body.data.id}/submissions`)
      .set('Cookie', respondent)
      .send({ answers: [{ questionId: q1, jsonValue: { r1: 'c1', r2: 'c2' } }] });

    expect(valid.status).toBe(201);
  });
});

describe('preview mode safety', () => {
  it('preview is wired to the shared renderer without any API persistence call', () => {
    const previewSource = fs.readFileSync(
      path.resolve(process.cwd(), '..', 'client', 'src', 'components', 'FormPreview.tsx'),
      'utf8'
    );
    expect(previewSource).toContain('mode="preview"');
    expect(previewSource).not.toContain('apiFetch');
    expect(previewSource).not.toContain('/api/campaigns');
  });
});
