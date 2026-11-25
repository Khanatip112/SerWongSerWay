import { Campaign, CampaignStatus, ContentBlock, Question, Section } from '../types/index.js';

export interface FormDraft {
  id?: string;
  title: string;
  description: string;
  status: CampaignStatus;
  closesAt: string;
  sections: Section[];
  questions: Question[];
  contentBlocks: ContentBlock[];
}

/** Stable client-side identifier for sections, questions, blocks and options. */
export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSection(orderIndex: number): Section {
  return {
    id: createId('section'),
    title: `Section ${orderIndex + 1}`,
    description: '',
    orderIndex,
    nextAction: 'NEXT_SECTION',
    targetSectionId: null,
  };
}

export function createQuestion(sectionId: string, orderIndex: number): Question {
  return {
    id: createId('question'),
    sectionId,
    prompt: 'Untitled Question',
    description: '',
    type: 'MULTIPLE_CHOICE',
    required: true,
    orderIndex,
    config: {
      options: [
        { id: createId('option'), label: 'Option 1' },
        { id: createId('option'), label: 'Option 2' },
      ],
      hasOtherOption: false,
      shuffleOptions: false,
      goToSectionBasedOnAnswer: false,
    },
    image: null,
  };
}

export function createContentBlock(type: 'TEXT_BLOCK' | 'IMAGE_BLOCK', sectionId: string, orderIndex: number): ContentBlock {
  return {
    id: createId('block'),
    sectionId,
    type,
    title: type === 'TEXT_BLOCK' ? 'Title' : '',
    description: type === 'TEXT_BLOCK' ? 'Description' : '',
    config:
      type === 'IMAGE_BLOCK'
        ? { imageUrl: '', alignment: 'center', width: 100, caption: '' }
        : null,
    orderIndex,
  };
}

/** Sorts items inside one section by their per-section order index. */
export function sectionItems(
  sectionId: string,
  questions: Question[],
  contentBlocks: ContentBlock[]
): Array<{ kind: 'question'; data: Question } | { kind: 'block'; data: ContentBlock }> {
  const items: Array<{ kind: 'question'; data: Question } | { kind: 'block'; data: ContentBlock }> = [
    ...questions.filter((q) => q.sectionId === sectionId).map((data) => ({ kind: 'question' as const, data })),
    ...contentBlocks.filter((b) => b.sectionId === sectionId).map((data) => ({ kind: 'block' as const, data })),
  ];

  return items.sort((a, b) => a.data.orderIndex - b.data.orderIndex);
}

/**
 * Converts a persisted campaign (including Sprint 1 campaigns with no sections or content
 * blocks) into the builder's draft shape without losing questions or their order.
 */
export function campaignToDraft(campaign: Campaign): FormDraft {
  const sortedSections = [...(campaign.sections || [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const sections: Section[] = sortedSections.length
    ? sortedSections.map((section, index) => ({
        ...section,
        orderIndex: index,
        nextAction: section.nextAction || 'NEXT_SECTION',
        targetSectionId: section.targetSectionId || null,
      }))
    : [createSection(0)];

  const sectionIds = new Set(sections.map((s) => s.id));
  const fallbackSectionId = sections[0].id;

  const questions: Question[] = [...(campaign.questions || [])]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((question) => ({
      ...question,
      sectionId: question.sectionId && sectionIds.has(question.sectionId) ? question.sectionId : fallbackSectionId,
      config: question.config || {},
    }));

  const contentBlocks: ContentBlock[] = [...(campaign.contentBlocks || [])]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((block) => ({
      ...block,
      sectionId: block.sectionId && sectionIds.has(block.sectionId) ? block.sectionId : fallbackSectionId,
      config: block.config || {},
    }));

  // Re-index items per section so legacy global order indexes remain stable and gap-free.
  for (const section of sections) {
    sectionItems(section.id, questions, contentBlocks).forEach((item, index) => {
      item.data.orderIndex = index;
    });
  }

  return {
    id: campaign.id,
    title: campaign.title || '',
    description: campaign.description || '',
    status: campaign.status || 'DRAFT',
    closesAt: campaign.closesAt ? toLocalDateTime(campaign.closesAt) : '',
    sections,
    questions,
    contentBlocks,
  };
}

export function toLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

/** Assigns contiguous order indexes to every section and its items. */
export function reindexDraft(draft: FormDraft): FormDraft {
  const sections = [...draft.sections].sort((a, b) => a.orderIndex - b.orderIndex).map((section, index) => ({
    ...section,
    orderIndex: index,
  }));

  const questions = draft.questions.map((q) => ({ ...q }));
  const contentBlocks = draft.contentBlocks.map((b) => ({ ...b }));

  for (const section of sections) {
    sectionItems(section.id, questions, contentBlocks).forEach((item, index) => {
      item.data.orderIndex = index;
    });
  }

  return { ...draft, sections, questions, contentBlocks };
}

/** Serializes a draft into the API payload accepted by POST/PUT /api/campaigns. */
export function draftToPayload(draft: FormDraft) {
  return {
    title: draft.title,
    description: draft.description,
    status: draft.status,
    closesAt: draft.closesAt ? new Date(draft.closesAt).toISOString() : null,
    sections: draft.sections.map((section, index) => ({
      id: section.id,
      title: section.title || `Section ${index + 1}`,
      description: section.description || null,
      orderIndex: index,
      nextAction: section.nextAction,
      targetSectionId: section.targetSectionId || null,
    })),
    questions: draft.questions.map((question, index) => ({
      id: question.id,
      sectionId: question.sectionId || null,
      prompt: question.prompt || 'Untitled Question',
      description: question.description || null,
      type: question.type,
      required: question.required,
      orderIndex: question.orderIndex ?? index,
      config: question.config || {},
      image: question.image || null,
    })),
    contentBlocks: draft.contentBlocks.map((block, index) => ({
      id: block.id,
      sectionId: block.sectionId || null,
      type: block.type,
      title: block.title || null,
      description: block.description || null,
      config: block.config || {},
      orderIndex: block.orderIndex ?? index,
    })),
  };
}
