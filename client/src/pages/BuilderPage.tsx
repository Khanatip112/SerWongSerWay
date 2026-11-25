import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/Alert.js';
import FloatingToolbar from '../components/FloatingToolbar.js';
import FormPreview from '../components/FormPreview.js';
import QuestionCard from '../components/QuestionCard.js';
import ContentBlockCard from '../components/ContentBlockCard.js';
import SectionCard, { SectionFooter } from '../components/SectionCard.js';
import { CampaignStatus, ContentBlock, Question, Section } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import {
  FormDraft,
  campaignToDraft,
  createContentBlock,
  createId,
  createQuestion,
  createSection,
  draftToPayload,
  reindexDraft,
  sectionItems,
} from '../utils/formModel.js';
import { cleanSectionReferencesOnDelete } from '../utils/sectionRouting.js';

type FormItem = { kind: 'question'; data: Question } | { kind: 'block'; data: ContentBlock };
type DragPayload = { kind: 'question' | 'block'; id: string } | { kind: 'section'; id: string };

const EMPTY_DRAFT: FormDraft = {
  title: '',
  description: '',
  status: 'DRAFT',
  closesAt: '',
  sections: [createSection(0)],
  questions: [],
  contentBlocks: [],
};

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function locateActive(draft: FormDraft, activeId: string | null): { sectionId: string; insertIndex: number } {
  const sortedSections = [...draft.sections].sort((a, b) => a.orderIndex - b.orderIndex);
  const fallbackSection = sortedSections[sortedSections.length - 1];

  if (!activeId) {
    return {
      sectionId: fallbackSection.id,
      insertIndex: sectionItems(fallbackSection.id, draft.questions, draft.contentBlocks).length,
    };
  }

  const section = draft.sections.find((candidate) => candidate.id === activeId);
  if (section) {
    return { sectionId: section.id, insertIndex: 0 };
  }

  const question = draft.questions.find((candidate) => candidate.id === activeId);
  if (question?.sectionId) {
    const items = sectionItems(question.sectionId, draft.questions, draft.contentBlocks);
    const index = items.findIndex((item) => item.data.id === question.id);
    return { sectionId: question.sectionId, insertIndex: index + 1 };
  }

  const block = draft.contentBlocks.find((candidate) => candidate.id === activeId);
  if (block?.sectionId) {
    const items = sectionItems(block.sectionId, draft.questions, draft.contentBlocks);
    const index = items.findIndex((item) => item.data.id === block.id);
    return { sectionId: block.sectionId, insertIndex: index + 1 };
  }

  return {
    sectionId: fallbackSection.id,
    insertIndex: sectionItems(fallbackSection.id, draft.questions, draft.contentBlocks).length,
  };
}

/** Rewrites order indexes for every item in one section from an explicit ordered list. */
function applySectionOrder(draft: FormDraft, sectionId: string, ordered: FormItem[]): FormDraft {
  const indexes = new Map(ordered.map((item, index) => [item.data.id, index]));
  return {
    ...draft,
    questions: draft.questions.map((question) =>
      question.sectionId === sectionId && indexes.has(question.id)
        ? { ...question, orderIndex: indexes.get(question.id)! }
        : question
    ),
    contentBlocks: draft.contentBlocks.map((block) =>
      block.sectionId === sectionId && indexes.has(block.id)
        ? { ...block, orderIndex: indexes.get(block.id)! }
        : block
    ),
  };
}

export const BuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(EMPTY_DRAFT.sections[0].id);
  const [loading, setLoading] = useState<boolean>(Boolean(id));
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState<CampaignStatus | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toolbarTop, setToolbarTop] = useState(0);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const response = await apiFetch(`/api/campaigns/${id}`);
        const body = await response.json();
        if (!response.ok) {
          if (response.status !== 401) {
            setLoadError(body.error?.message || 'Failed to load campaign.');
          }
          return;
        }
        if (!mounted) return;
        const loaded = campaignToDraft(body.data as Parameters<typeof campaignToDraft>[0]);
        setDraft(loaded);
        setActiveBlockId(loaded.questions[0]?.id || loaded.sections[0]?.id || null);
      } catch {
        if (mounted) setLoadError('Network error loading campaign.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Keep the desktop floating toolbar aligned with the active card.
  useEffect(() => {
    if (previewOpen) return;
    const element = activeBlockId ? document.getElementById(`builder-block-${activeBlockId}`) : null;
    const container = containerRef.current;
    if (!element || !container) return;
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setToolbarTop(Math.max(0, elementRect.top - containerRect.top));
  }, [activeBlockId, draft, previewOpen]);

  const sections = useMemo(
    () => [...draft.sections].sort((a, b) => a.orderIndex - b.orderIndex),
    [draft.sections]
  );

  const focusBlock = (blockId: string) => {
    setActiveBlockId(blockId);
    window.requestAnimationFrame(() => {
      document.getElementById(`builder-block-${blockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const insertItems = (newQuestions: Question[], newBlocks: ContentBlock[]) => {
    const { sectionId, insertIndex } = locateActive(draft, activeBlockId);
    const existing = sectionItems(sectionId, draft.questions, draft.contentBlocks);
    const inserted: FormItem[] = [
      ...newQuestions.map((data) => ({ kind: 'question' as const, data })),
      ...newBlocks.map((data) => ({ kind: 'block' as const, data })),
    ];

    const otherQuestions = draft.questions.filter((question) => question.sectionId !== sectionId);
    const otherBlocks = draft.contentBlocks.filter((block) => block.sectionId !== sectionId);
    const ordered = [...existing.slice(0, insertIndex), ...inserted, ...existing.slice(insertIndex)].map(
      (item, index) => ({ ...item, data: { ...item.data, orderIndex: index } })
    );

    setDraft(
      reindexDraft({
        ...draft,
        questions: [
          ...otherQuestions,
          ...ordered.filter((item) => item.kind === 'question').map((item) => item.data as Question),
        ],
        contentBlocks: [
          ...otherBlocks,
          ...ordered.filter((item) => item.kind === 'block').map((item) => item.data as ContentBlock),
        ],
      })
    );

    const lastInserted = inserted[inserted.length - 1]?.data.id;
    if (lastInserted) focusBlock(lastInserted);
  };

  const handleAddQuestion = () => {
    const { sectionId, insertIndex } = locateActive(draft, activeBlockId);
    const question = createQuestion(sectionId, insertIndex);
    insertItems([question], []);
  };

  const handleAddTextBlock = () => {
    const { sectionId, insertIndex } = locateActive(draft, activeBlockId);
    insertItems([], [createContentBlock('TEXT_BLOCK', sectionId, insertIndex)]);
  };

  const handleAddImageBlock = () => {
    const { sectionId, insertIndex } = locateActive(draft, activeBlockId);
    insertItems([], [createContentBlock('IMAGE_BLOCK', sectionId, insertIndex)]);
  };

  const handleAddSection = () => {
    const { sectionId, insertIndex } = locateActive(draft, activeBlockId);
    const currentIndex = sections.findIndex((section) => section.id === sectionId);
    const items = sectionItems(sectionId, draft.questions, draft.contentBlocks);
    const movedIds = new Set(items.slice(insertIndex).map((item) => item.data.id));
    const newSection = createSection(currentIndex + 1);

    const updatedSections = [...draft.sections];
    const insertAt = currentIndex >= 0 ? currentIndex + 1 : updatedSections.length;
    updatedSections.splice(insertAt, 0, newSection);

    const movedQuestions = draft.questions
      .filter((question) => movedIds.has(question.id))
      .map((question, index) => ({ ...question, sectionId: newSection.id, orderIndex: index }));
    const movedBlocks = draft.contentBlocks
      .filter((block) => movedIds.has(block.id))
      .map((block, index) => ({ ...block, sectionId: newSection.id, orderIndex: index }));

    setDraft(
      reindexDraft({
        ...draft,
        sections: updatedSections,
        questions: [...draft.questions.filter((question) => !movedIds.has(question.id)), ...movedQuestions],
        contentBlocks: [...draft.contentBlocks.filter((block) => !movedIds.has(block.id)), ...movedBlocks],
      })
    );

    focusBlock(newSection.id);
  };

  const handleUpdateQuestion = (updated: Question) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => (question.id === updated.id ? updated : question)),
    }));
  };

  const handleUpdateBlock = (updated: ContentBlock) => {
    setDraft((prev) => ({
      ...prev,
      contentBlocks: prev.contentBlocks.map((block) => (block.id === updated.id ? updated : block)),
    }));
  };

  const handleUpdateSection = (updated: Section) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => (section.id === updated.id ? updated : section)),
    }));
  };

  const handleDeleteQuestion = (question: Question) => {
    const sectionId = question.sectionId || sections[0].id;
    const remaining = draft.questions.filter((candidate) => candidate.id !== question.id);
    setDraft(reindexDraft({ ...draft, questions: remaining }));
    const items = sectionItems(sectionId, remaining, draft.contentBlocks);
    focusBlock(items[0]?.data.id || sectionId);
  };

  const handleDeleteBlock = (block: ContentBlock) => {
    const sectionId = block.sectionId || sections[0].id;
    const remaining = draft.contentBlocks.filter((candidate) => candidate.id !== block.id);
    setDraft(reindexDraft({ ...draft, contentBlocks: remaining }));
    const items = sectionItems(sectionId, draft.questions, remaining);
    focusBlock(items[0]?.data.id || sectionId);
  };

  const cloneQuestion = (question: Question): Question => ({
    ...question,
    id: createId('question'),
    config: {
      ...(question.config || {}),
      options: (question.config?.options || []).map((option) => ({ ...option, id: createId('option') })),
    },
  });

  const handleDuplicateQuestion = (question: Question) => {
    const clone = cloneQuestion(question);
    const sectionId = question.sectionId || sections[0].id;
    const items = sectionItems(sectionId, draft.questions, draft.contentBlocks);
    const index = items.findIndex((item) => item.data.id === question.id);
    const ordered: FormItem[] = [...items];
    ordered.splice(index + 1, 0, { kind: 'question', data: clone });

    setDraft(
      reindexDraft(
        applySectionOrder(
          {
            ...draft,
            questions: [...draft.questions, { ...clone, sectionId }],
          },
          sectionId,
          ordered
        )
      )
    );
    focusBlock(clone.id);
  };

  const handleDuplicateBlock = (block: ContentBlock) => {
    const sectionId = block.sectionId || sections[0].id;
    const clone: ContentBlock = {
      ...block,
      id: createId('block'),
      config: { ...(block.config || {}) },
    };
    const items = sectionItems(sectionId, draft.questions, draft.contentBlocks);
    const index = items.findIndex((item) => item.data.id === block.id);
    const ordered: FormItem[] = [...items];
    ordered.splice(index + 1, 0, { kind: 'block', data: clone });

    setDraft(
      reindexDraft(
        applySectionOrder(
          {
            ...draft,
            contentBlocks: [...draft.contentBlocks, { ...clone, sectionId }],
          },
          sectionId,
          ordered
        )
      )
    );
    focusBlock(clone.id);
  };

  const handleDeleteSection = (section: Section) => {
    if (draft.sections.length <= 1) return;
    const remainingSections = draft.sections.filter((candidate) => candidate.id !== section.id);
    const remainingQuestions = draft.questions.filter((question) => question.sectionId !== section.id);
    const remainingBlocks = draft.contentBlocks.filter((block) => block.sectionId !== section.id);
    const cleaned = cleanSectionReferencesOnDelete(section.id, remainingSections, remainingQuestions);
    const next = reindexDraft({
      ...draft,
      sections: cleaned.updatedSections,
      questions: cleaned.updatedQuestions,
      contentBlocks: remainingBlocks,
    });
    setDraft(next);
    focusBlock(next.sections[0].id);
  };

  const handleDuplicateSection = (section: Section) => {
    const clonedSection: Section = {
      ...section,
      id: createId('section'),
      title: `${section.title || 'Section'} (copy)`,
    };
    const items = sectionItems(section.id, draft.questions, draft.contentBlocks);
    const clonedQuestions = items
      .filter((item) => item.kind === 'question')
      .map((item, index) => ({ ...cloneQuestion(item.data as Question), sectionId: clonedSection.id, orderIndex: index }));
    const clonedBlocks = items
      .filter((item) => item.kind === 'block')
      .map((item, index) => ({
        ...(item.data as ContentBlock),
        id: createId('block'),
        sectionId: clonedSection.id,
        orderIndex: index,
        config: { ...((item.data as ContentBlock).config || {}) },
      }));

    const sectionIndex = sections.findIndex((candidate) => candidate.id === section.id);
    const updatedSections = [...draft.sections];
    updatedSections.splice(sectionIndex + 1, 0, clonedSection);

    setDraft(
      reindexDraft({
        ...draft,
        sections: updatedSections,
        questions: [...draft.questions, ...clonedQuestions],
        contentBlocks: [...draft.contentBlocks, ...clonedBlocks],
      })
    );
    focusBlock(clonedSection.id);
  };

  const handleMergeSection = (section: Section) => {
    const index = sections.findIndex((candidate) => candidate.id === section.id);
    if (index <= 0) return;
    const previous = sections[index - 1];
    const items = sectionItems(section.id, draft.questions, draft.contentBlocks);
    const previousItems = sectionItems(previous.id, draft.questions, draft.contentBlocks);
    const movedIds = new Set(items.map((item) => item.data.id));

    const updatedQuestions = draft.questions.map((question) =>
      movedIds.has(question.id) ? { ...question, sectionId: previous.id } : question
    );
    const updatedBlocks = draft.contentBlocks.map((block) =>
      movedIds.has(block.id) ? { ...block, sectionId: previous.id } : block
    );
    const mergedItems: FormItem[] = [
      ...previousItems,
      ...items.map((item): FormItem =>
        item.kind === 'question'
          ? { kind: 'question', data: { ...item.data, sectionId: previous.id } }
          : { kind: 'block', data: { ...item.data, sectionId: previous.id } }
      ),
    ];
    const remainingSections = draft.sections.filter((candidate) => candidate.id !== section.id);
    const cleaned = cleanSectionReferencesOnDelete(section.id, remainingSections, updatedQuestions);

    setDraft(
      reindexDraft(
        applySectionOrder(
          {
            ...draft,
            sections: cleaned.updatedSections,
            questions: cleaned.updatedQuestions,
            contentBlocks: updatedBlocks,
          },
          previous.id,
          mergedItems
        )
      )
    );
    focusBlock(previous.id);
  };

  const handleMoveSection = (sectionId: string, direction: -1 | 1) => {
    const ordered = [...sections];
    const index = ordered.findIndex((section) => section.id === sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setDraft(reindexDraft({ ...draft, sections: ordered.map((section, orderIndex) => ({ ...section, orderIndex })) }));
  };

  const moveItemWithinSection = (itemId: string, direction: -1 | 1) => {
    const item =
      draft.questions.find((question) => question.id === itemId) ||
      draft.contentBlocks.find((block) => block.id === itemId);
    const sectionId = item?.sectionId || sections[0].id;
    const items = sectionItems(sectionId, draft.questions, draft.contentBlocks);
    const index = items.findIndex((candidate) => candidate.data.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    const ordered = [...items];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setDraft(reindexDraft(applySectionOrder(draft, sectionId, ordered)));
  };

  const moveItemToSection = (payload: DragPayload & { kind: 'question' | 'block'; id: string }, targetSectionId: string, targetIndex: number) => {
    const question = draft.questions.find((candidate) => candidate.id === payload.id);
    const block = draft.contentBlocks.find((candidate) => candidate.id === payload.id);
    const item = question || block;
    if (!item) return;
    const sourceSectionId = item.sectionId || sections[0].id;

    // Dropping an earlier item "before" a later target must account for its removal.
    let adjustedTargetIndex = targetIndex;
    if (sourceSectionId === targetSectionId) {
      const currentItems = sectionItems(targetSectionId, draft.questions, draft.contentBlocks);
      const currentIndex = currentItems.findIndex((candidate) => candidate.data.id === payload.id);
      if (currentIndex >= 0 && currentIndex < targetIndex) {
        adjustedTargetIndex -= 1;
      }
    }

    let next: FormDraft =
      payload.kind === 'question'
        ? {
            ...draft,
            questions: draft.questions.map((candidate) =>
              candidate.id === payload.id ? { ...candidate, sectionId: targetSectionId } : candidate
            ),
          }
        : {
            ...draft,
            contentBlocks: draft.contentBlocks.map((candidate) =>
              candidate.id === payload.id ? { ...candidate, sectionId: targetSectionId } : candidate
            ),
          };

    const targetItems = sectionItems(targetSectionId, next.questions, next.contentBlocks).filter(
      (candidate) => candidate.data.id !== payload.id
    );
    const movedItem: FormItem =
      payload.kind === 'question'
        ? { kind: 'question', data: next.questions.find((candidate) => candidate.id === payload.id)! }
        : { kind: 'block', data: next.contentBlocks.find((candidate) => candidate.id === payload.id)! };

    const clamped = Math.max(0, Math.min(adjustedTargetIndex, targetItems.length));
    const ordered = [...targetItems];
    ordered.splice(clamped, 0, movedItem);
    next = applySectionOrder(next, targetSectionId, ordered);

    if (sourceSectionId !== targetSectionId) {
      const sourceItems = sectionItems(sourceSectionId, next.questions, next.contentBlocks);
      next = applySectionOrder(next, sourceSectionId, sourceItems);
    }

    setDraft(reindexDraft(next));
    focusBlock(payload.id);
  };

  const handleItemDrop = (targetSectionId: string, targetIndex: number) => {
    if (!dragging || dragging.kind === 'section') return;
    moveItemToSection(dragging, targetSectionId, targetIndex);
    setDragging(null);
  };

  const handleSectionDrop = (targetSectionId: string) => {
    if (!dragging || dragging.kind !== 'section' || dragging.id === targetSectionId) {
      setDragging(null);
      return;
    }
    const ordered = sections.filter((section) => section.id !== dragging.id);
    const targetIndex = ordered.findIndex((section) => section.id === targetSectionId);
    const dragged = sections.find((section) => section.id === dragging.id);
    if (!dragged) {
      setDragging(null);
      return;
    }
    ordered.splice(targetIndex < 0 ? ordered.length : targetIndex, 0, dragged);
    setDraft(
      reindexDraft({ ...draft, sections: ordered.map((section, orderIndex) => ({ ...section, orderIndex })) })
    );
    setDragging(null);
  };

  const validateForSave = (status: CampaignStatus): string | null => {
    if (!draft.title.trim()) return 'Campaign title is required.';
    if (status === 'PUBLISHED' && draft.title.trim().length < 3) {
      return 'Campaign title must be at least 3 characters.';
    }
    if (status === 'PUBLISHED' && draft.questions.length === 0) {
      return 'Add at least one question before publishing.';
    }
    const emptyPrompt = draft.questions.find((question) => !plainText(question.prompt || ''));
    if (emptyPrompt) return 'Every question needs a prompt.';
    return null;
  };

  const handleSave = async (status: CampaignStatus) => {
    setError('');
    setNotice('');
    const validationError = validateForSave(status);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(status);
    try {
      const payload = draftToPayload({ ...draft, status });
      const response = await apiFetch(draft.id ? `/api/campaigns/${draft.id}` : '/api/campaigns', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        if (response.status !== 401) {
          setError(body.error?.message || 'Failed to save campaign.');
        }
        return;
      }

      if (status === 'PUBLISHED') {
        navigate('/campaigns');
        return;
      }

      const saved = campaignToDraft(body.data as Parameters<typeof campaignToDraft>[0]);
      setDraft(saved);
      setActiveBlockId(saved.questions[0]?.id || saved.sections[0]?.id || null);
      if (!draft.id) {
        navigate(`/campaigns/${saved.id}/edit`, { replace: true });
      } else {
        setNotice('Draft saved.');
      }
    } catch {
      setError('Network error saving campaign.');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          Loading form builder...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container" style={{ maxWidth: '640px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <Alert type="error" message={loadError} />
          <Link to="/campaigns" className="btn-outline" style={{ marginTop: '1rem', display: 'inline-block' }}>
            ← Back to Campaigns
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg-page)', minHeight: 'calc(100vh - 64px)', paddingBottom: '5rem' }}>
      {/* Pastel top header bar */}
      <header className="builder-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate('/campaigns')}
            style={{ padding: '0.35rem 0.7rem', backgroundColor: '#ffffff' }}
          >
            ←
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {draft.title.trim() || 'Untitled form'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Form Builder · <span className={`badge ${draft.status === 'PUBLISHED' ? 'badge-published' : draft.status === 'CLOSED' ? 'badge-closed' : 'badge-draft'}`}>{draft.status}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-outline" style={{ backgroundColor: '#ffffff' }} onClick={() => setPreviewOpen(true)}>
            👁 Preview
          </button>
          <button type="button" className="btn-outline" style={{ backgroundColor: '#ffffff' }} onClick={() => handleSave('DRAFT')} disabled={saving !== null}>
            {saving === 'DRAFT' ? 'Saving...' : 'Save Draft'}
          </button>
          <button type="button" className="btn-primary" onClick={() => handleSave('PUBLISHED')} disabled={saving !== null}>
            {saving === 'PUBLISHED' ? 'Publishing...' : draft.status === 'PUBLISHED' ? 'Update Published Form' : 'Publish'}
          </button>
        </div>
      </header>

      <div className="container builder-container" ref={containerRef} style={{ maxWidth: '860px', position: 'relative' }}>
        <FloatingToolbar
          topOffset={toolbarTop}
          onAddQuestion={handleAddQuestion}
          onAddTextBlock={handleAddTextBlock}
          onAddImageBlock={handleAddImageBlock}
          onAddSection={handleAddSection}
        />

        {error && <Alert type="error" message={error} />}
        {notice && <Alert type="success" message={notice} />}

        {/* Campaign meta */}
        <div
          id="builder-block-meta"
          className="card"
          onClick={() => setActiveBlockId(null)}
          style={{ marginBottom: '1rem', borderTop: '8px solid var(--color-brand-pastel)' }}
        >
          <div className="form-group">
            <label className="form-label" htmlFor="campaign-title">
              Form title *
            </label>
            <input
              id="campaign-title"
              name="title"
              type="text"
              className="form-input"
              placeholder="Untitled form"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              style={{ fontSize: '1.1rem', fontWeight: 600 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" htmlFor="campaign-description">
              Form description
            </label>
            <textarea
              id="campaign-description"
              name="description"
              className="form-textarea"
              rows={2}
              placeholder="Describe the purpose of this form..."
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0, maxWidth: '320px' }}>
            <label className="form-label" htmlFor="campaign-closes-at">
              Closing deadline (optional)
            </label>
            <input
              id="campaign-closes-at"
              type="datetime-local"
              className="form-input"
              value={draft.closesAt}
              onChange={(event) => setDraft({ ...draft, closesAt: event.target.value })}
            />
          </div>
        </div>

        {sections.map((section, sectionIndex) => {
          const items = sectionItems(section.id, draft.questions, draft.contentBlocks);
          const questionsInSection = items.filter((item) => item.kind === 'question');

          return (
            <div
              key={section.id}
              className={dragOverSection === section.id ? 'section-drop-active' : undefined}
              onDragOver={(event) => {
                if (dragging?.kind === 'section') {
                  event.preventDefault();
                  setDragOverSection(section.id);
                }
              }}
              onDragLeave={() => setDragOverSection((current) => (current === section.id ? null : current))}
            >
              <div id={`builder-block-${section.id}`}>
                <SectionCard
                  section={section}
                  index={sectionIndex}
                  totalSections={sections.length}
                  isActive={activeBlockId === section.id}
                  onFocus={() => setActiveBlockId(section.id)}
                  onChange={handleUpdateSection}
                  onDuplicate={() => handleDuplicateSection(section)}
                  onDelete={() => handleDeleteSection(section)}
                  onMergeAbove={() => handleMergeSection(section)}
                  onMoveUp={() => handleMoveSection(section.id, -1)}
                  onMoveDown={() => handleMoveSection(section.id, 1)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    setDragging({ kind: 'section', id: section.id });
                  }}
                  onDrop={() => handleSectionDrop(section.id)}
                />
              </div>

              {items.map((item, itemIndex) => {
                const questionIndex = questionsInSection.findIndex((entry) => entry.data.id === item.data.id);

                if (item.kind === 'question') {
                  return (
                    <div
                      key={item.data.id}
                      id={`builder-block-${item.data.id}`}
                      draggable={false}
                      onDragOver={(event) => {
                        if (dragging && dragging.kind !== 'section') event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.stopPropagation();
                        handleItemDrop(section.id, itemIndex);
                      }}
                    >
                      <QuestionCard
                        question={item.data}
                        index={questionIndex}
                        displayIndex={questionIndex}
                        totalQuestions={questionsInSection.length}
                        canMoveUp={itemIndex > 0}
                        canMoveDown={itemIndex < items.length - 1}
                        isActive={activeBlockId === item.data.id}
                        onFocus={() => setActiveBlockId(item.data.id)}
                        onChange={handleUpdateQuestion}
                        onDuplicate={() => handleDuplicateQuestion(item.data)}
                        onDelete={() => handleDeleteQuestion(item.data)}
                        onMoveUp={() => moveItemWithinSection(item.data.id, -1)}
                        onMoveDown={() => moveItemWithinSection(item.data.id, 1)}
                        sections={sections}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          setDragging({ kind: 'question', id: item.data.id });
                        }}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={item.data.id}
                    id={`builder-block-${item.data.id}`}
                    onDragOver={(event) => {
                      if (dragging && dragging.kind !== 'section') event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.stopPropagation();
                      handleItemDrop(section.id, itemIndex);
                    }}
                  >
                    <ContentBlockCard
                      block={item.data}
                      index={itemIndex}
                      totalBlocks={items.length}
                      isActive={activeBlockId === item.data.id}
                      onFocus={() => setActiveBlockId(item.data.id)}
                      onChange={handleUpdateBlock}
                      onDuplicate={() => handleDuplicateBlock(item.data)}
                      onDelete={() => handleDeleteBlock(item.data)}
                      onMoveUp={() => moveItemWithinSection(item.data.id, -1)}
                      onMoveDown={() => moveItemWithinSection(item.data.id, 1)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        setDragging({ kind: 'block', id: item.data.id });
                      }}
                      onDrop={() => handleItemDrop(section.id, itemIndex)}
                    />
                  </div>
                );
              })}

              <div
                onDragOver={(event) => {
                  if (dragging && dragging.kind !== 'section') event.preventDefault();
                }}
                onDrop={(event) => {
                  event.stopPropagation();
                  handleItemDrop(section.id, items.length);
                }}
              >
                <SectionFooter
                  section={section}
                  index={sectionIndex}
                  sections={sections}
                  onChange={handleUpdateSection}
                />
              </div>
            </div>
          );
        })}

        {draft.questions.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Use the toolbar to add your first question.
          </div>
        )}
      </div>

      {previewOpen && (
        <FormPreview
          campaign={{
            id: draft.id,
            title: draft.title || 'Untitled form',
            description: draft.description,
            status: draft.status,
            sections: draft.sections,
            questions: draft.questions,
            contentBlocks: draft.contentBlocks,
          }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export default BuilderPage;
