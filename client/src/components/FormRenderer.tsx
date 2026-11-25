import React, { useMemo, useState } from 'react';
import {
  Campaign,
  ContentBlock,
  Question,
  QuestionConfig,
  QuestionOption,
  Section,
} from '../types/index.js';
import { resolveNextSection } from '../utils/sectionRouting.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';
import {
  AnswerState,
  fileAcceptAttribute,
  validateClientAnswer,
  validateFileSelection,
} from '../utils/validation.js';

export interface AnswerPayload {
  questionId: string;
  ratingValue: number | null;
  textValue: string | null;
  jsonValue: unknown;
}

type FormCampaign = Partial<Campaign> & {
  title: string;
  description?: string;
  sections?: Section[];
  questions?: Question[];
  contentBlocks?: ContentBlock[];
};

interface FormRendererProps {
  campaign: FormCampaign;
  mode: 'preview' | 'live';
  onSubmit: (answers: AnswerPayload[]) => Promise<boolean>;
  onCancel?: () => void;
  submitting?: boolean;
  externalError?: string;
  successActions?: React.ReactNode;
  disabled?: boolean;
}

const VIRTUAL_SECTION_ID = '__default_section__';

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let state = seed || 1;
  for (let i = copy.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function Icon({ kind, filled }: { kind: 'STAR' | 'HEART' | 'THUMBS_UP'; filled: boolean }) {
  const symbol = kind === 'HEART' ? '♥' : kind === 'THUMBS_UP' ? '👍' : '★';
  return (
    <span style={{ color: filled ? '#f59e0b' : '#d1d5db', fontSize: '1.6rem', lineHeight: 1 }}>
      {symbol}
    </span>
  );
}

export const FormRenderer: React.FC<FormRendererProps> = ({
  campaign,
  mode,
  onSubmit,
  onCancel,
  submitting = false,
  externalError,
  successActions,
  disabled = false,
}) => {
  const questions = campaign.questions || [];
  const contentBlocks = campaign.contentBlocks || [];

  const sections: Section[] = useMemo(() => {
    if (campaign.sections && campaign.sections.length > 0) {
      return [...campaign.sections].sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return [
      {
        id: VIRTUAL_SECTION_ID,
        title: campaign.title || 'Survey',
        description: campaign.description || '',
        orderIndex: 0,
        nextAction: 'SUBMIT_FORM',
        targetSectionId: null,
      },
    ];
  }, [campaign.sections, campaign.title, campaign.description]);

  const isVirtual = sections.length === 1 && sections[0].id === VIRTUAL_SECTION_ID;

  const [shuffleSeed] = useState(() => Math.floor(Math.random() * 2147483646) + 1);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentSectionId, setCurrentSectionId] = useState<string>(sections[0]?.id || VIRTUAL_SECTION_ID);
  const [visitedStack, setVisitedStack] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [hoverRating, setHoverRating] = useState<Record<string, number | null>>({});

  const currentSection = sections.find((s) => s.id === currentSectionId) || sections[0];
  const currentSectionIndex = Math.max(0, sections.findIndex((s) => s.id === currentSection.id));

  const questionsInSection = useMemo(
    () =>
      questions
        .filter((q) => (isVirtual ? true : q.sectionId === currentSection.id || (!q.sectionId && currentSectionIndex === 0)))
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [questions, isVirtual, currentSection.id, currentSectionIndex]
  );

  const blocksInSection = useMemo(
    () =>
      contentBlocks
        .filter((b) => (isVirtual ? true : b.sectionId === currentSection.id || (!b.sectionId && currentSectionIndex === 0)))
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [contentBlocks, isVirtual, currentSection.id, currentSectionIndex]
  );

  const items: Array<{ kind: 'question'; data: Question } | { kind: 'block'; data: ContentBlock }> = [
    ...questionsInSection.map((data) => ({ kind: 'question' as const, data })),
    ...blocksInSection.map((data) => ({ kind: 'block' as const, data })),
  ].sort((a, b) => a.data.orderIndex - b.data.orderIndex);

  const optionOrder = useMemo(() => {
    const map: Record<string, QuestionOption[]> = {};
    for (const question of questions) {
      const options = question.config?.options || [];
      map[question.id] = question.config?.shuffleOptions
        ? shuffleWithSeed(options, shuffleSeed ^ hashString(question.id))
        : options;
    }
    return map;
  }, [questions, shuffleSeed]);

  const rowOrder = useMemo(() => {
    const map: Record<string, Array<{ id: string; label: string }>> = {};
    for (const question of questions) {
      const rows = question.config?.grid?.rows || [];
      map[question.id] = question.config?.grid?.shuffleRows
        ? shuffleWithSeed(rows, shuffleSeed ^ hashString(`${question.id}_rows`))
        : rows;
    }
    return map;
  }, [questions, shuffleSeed]);

  const setAnswer = (questionId: string, partial: AnswerState) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...partial } }));
    setErrors((prev) => (prev[questionId] ? { ...prev, [questionId]: '' } : prev));
  };

  const validateSection = (): boolean => {
    const nextErrors: Record<string, string> = {};
    for (const question of questionsInSection) {
      const error = validateClientAnswer(question, answers[question.id]);
      if (error) nextErrors[question.id] = error;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildPayload = (): AnswerPayload[] =>
    Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      ratingValue: answer.ratingValue ?? null,
      textValue: answer.textValue ?? null,
      jsonValue: answer.jsonValue ?? null,
    }));

  const handleNextOrSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || disabled) return;
    if (!validateSection()) return;

    const routing = resolveNextSection(currentSection, sections, questionsInSection, answers, visitedStack);

    if (routing.action === 'SUBMIT_FORM' || !routing.targetSectionId) {
      const ok = await onSubmit(buildPayload());
      if (ok) setSubmitted(true);
      return;
    }

    setVisitedStack((prev) => [...prev, currentSection.id]);
    setCurrentSectionId(routing.targetSectionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (visitedStack.length === 0) return;
    const previous = visitedStack[visitedStack.length - 1];
    setVisitedStack((prev) => prev.slice(0, -1));
    setCurrentSectionId(previous);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const routingPreview = resolveNextSection(currentSection, sections, questionsInSection, answers, visitedStack);
  const isSubmitAction = routingPreview.action === 'SUBMIT_FORM';

  if (submitted) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {mode === 'preview' ? 'Response Recorded (Simulated)' : 'Response Submitted'}
        </h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          {mode === 'preview'
            ? `Your simulated response to "${campaign.title}" was completed successfully. In Preview Mode, no database records are created.`
            : 'Your response has been submitted successfully. Thank you for your feedback!'}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {mode === 'preview' && (
            <button
              type="button"
              className="btn-pastel"
              onClick={() => {
                setSubmitted(false);
                setAnswers({});
                setErrors({});
                setVisitedStack([]);
                setCurrentSectionId(sections[0].id);
              }}
            >
              Submit another response
            </button>
          )}
          {successActions}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleNextOrSubmit} style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Form title card */}
      <div className="card" style={{ width: '100%', boxSizing: 'border-box', marginBottom: '1.25rem', borderTop: '8px solid var(--color-brand-pastel)' }}>
        {campaign.sections && campaign.sections.length > 1 && (
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            Section {currentSectionIndex + 1} of {sections.length}
          </div>
        )}
        <h1 style={{ fontSize: '1.55rem', fontWeight: 700, marginBottom: '0.5rem' }}>{campaign.title}</h1>
        {campaign.description && (
          <div
            style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(campaign.description) }}
          />
        )}
      </div>

      {/* Section header (only when the form has authored sections) */}
      {!isVirtual && (
        <div className="card" style={{ width: '100%', boxSizing: 'border-box', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
            Section {currentSectionIndex + 1} of {sections.length}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }} dangerouslySetInnerHTML={{ __html: currentSection.title || `Section ${currentSectionIndex + 1}` }} />
          {currentSection.description && (
            <div
              style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}
              dangerouslySetInnerHTML={{ __html: currentSection.description }}
            />
          )}
        </div>
      )}

      {externalError && (
        <div className="alert alert-error" role="alert">
          {externalError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
        {items.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No content in this section.
          </div>
        )}

        {items.map((item) => {
          if (item.kind === 'block') {
            const block = item.data;
            if (block.type === 'TEXT_BLOCK') {
              return (
                <div key={block.id} className="card">
                  {block.title && (
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }} dangerouslySetInnerHTML={{ __html: block.title }} />
                  )}
                  {block.description && (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }} dangerouslySetInnerHTML={{ __html: block.description }} />
                  )}
                </div>
              );
            }

            const alignment = block.config?.alignment || 'center';
            const width = block.config?.width ? `${block.config.width}%` : 'auto';
            return (
              <div key={block.id} className="card" style={{ textAlign: alignment }}>
                {block.title && (
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem' }} dangerouslySetInnerHTML={{ __html: block.title }} />
                )}
                {block.config?.imageUrl ? (
                  <img
                    src={block.config.imageUrl}
                    alt={block.config.caption || 'Form image'}
                    style={{ width, maxWidth: '100%', margin: alignment === 'center' ? '0 auto' : undefined, borderRadius: '6px', display: 'block' }}
                  />
                ) : (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '1rem', border: '1px dashed var(--color-border-subtle)', borderRadius: '6px' }}>
                    Image not set
                  </div>
                )}
                {block.config?.caption && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>{block.config.caption}</div>
                )}
              </div>
            );
          }

          const question = item.data;
          const config: QuestionConfig = question.config || {};
          const answer = answers[question.id] || {};
          const error = errors[question.id];
          const options = optionOrder[question.id] || config.options || [];
          const rows = rowOrder[question.id] || config.grid?.rows || [];
          const columns = config.grid?.columns || [];

          return (
            <div
              key={question.id}
              className="card"
              style={{ width: '100%', boxSizing: 'border-box', borderLeft: error ? '4px solid var(--color-error)' : '1px solid var(--color-border-subtle)' }}
            >
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.02rem', fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: question.prompt }} />
                  {question.required && <span style={{ color: 'var(--color-error)', fontWeight: 700 }}>*</span>}
                </div>
                {question.description && (
                  <div
                    style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}
                    dangerouslySetInnerHTML={{ __html: question.description }}
                  />
                )}
                {question.image?.url && (
                  <div style={{ textAlign: question.image.alignment || 'center', marginTop: '0.75rem' }}>
                    <img
                      src={question.image.url}
                      alt={question.image.caption || 'Question image'}
                      style={{
                        width: question.image.width ? `${question.image.width}%` : 'auto',
                        maxWidth: '100%',
                        borderRadius: '6px',
                        display: 'inline-block',
                      }}
                    />
                    {question.image.caption && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{question.image.caption}</div>
                    )}
                  </div>
                )}
              </div>

              {/* 1. Short answer */}
              {(question.type === 'SHORT_ANSWER' || question.type === 'TEXT') && (
                <input
                  type="text"
                  className="form-input"
                  placeholder="Your answer"
                  value={answer.textValue || ''}
                  onChange={(event) => setAnswer(question.id, { textValue: event.target.value, jsonValue: event.target.value })}
                  disabled={disabled || submitting}
                />
              )}

              {/* 2. Paragraph */}
              {question.type === 'PARAGRAPH' && (
                <textarea
                  rows={4}
                  className="form-textarea"
                  placeholder="Your answer"
                  value={answer.textValue || ''}
                  onChange={(event) => setAnswer(question.id, { textValue: event.target.value, jsonValue: event.target.value })}
                  disabled={disabled || submitting}
                />
              )}

              {/* 3. Multiple choice */}
              {question.type === 'MULTIPLE_CHOICE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {options.map((option) => {
                    const selected =
                      (answer.jsonValue as { selectedOptionId?: string } | undefined)?.selectedOptionId === option.id;
                    return (
                      <label key={option.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`q_${question.id}`}
                          checked={selected}
                          onChange={() => setAnswer(question.id, { jsonValue: { selectedOptionId: option.id }, textValue: undefined })}
                          disabled={disabled || submitting}
                        />
                        {option.imageUrl && (
                          <img src={option.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                        )}
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                  {config.hasOtherOption && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`q_${question.id}`}
                          checked={(answer.jsonValue as { selectedOptionId?: string } | undefined)?.selectedOptionId === 'OTHER'}
                          onChange={() => setAnswer(question.id, { jsonValue: { selectedOptionId: 'OTHER', otherText: '' } })}
                          disabled={disabled || submitting}
                        />
                        <span>Other:</span>
                      </label>
                      {(answer.jsonValue as { selectedOptionId?: string } | undefined)?.selectedOptionId === 'OTHER' && (
                        <input
                          type="text"
                          className="form-input"
                          style={{ flex: 1, minWidth: '160px' }}
                          placeholder="Specify other..."
                          value={(answer.jsonValue as { otherText?: string } | undefined)?.otherText || ''}
                          onChange={(event) =>
                            setAnswer(question.id, { jsonValue: { selectedOptionId: 'OTHER', otherText: event.target.value } })
                          }
                          disabled={disabled || submitting}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 4. Checkboxes */}
              {question.type === 'CHECKBOXES' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {options.map((option) => {
                    const selectedIds = Array.isArray(answer.jsonValue) ? (answer.jsonValue as string[]) : [];
                    return (
                      <label key={option.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(option.id)}
                          onChange={() => {
                            const next = selectedIds.includes(option.id)
                              ? selectedIds.filter((id) => id !== option.id)
                              : [...selectedIds, option.id];
                            setAnswer(question.id, { jsonValue: next });
                          }}
                          disabled={disabled || submitting}
                        />
                        {option.imageUrl && (
                          <img src={option.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                        )}
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                  {config.hasOtherOption && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Array.isArray(answer.jsonValue) && (answer.jsonValue as string[]).includes('OTHER')}
                          onChange={() => {
                            const selectedIds = Array.isArray(answer.jsonValue) ? (answer.jsonValue as string[]) : [];
                            const next = selectedIds.includes('OTHER')
                              ? selectedIds.filter((id) => id !== 'OTHER')
                              : [...selectedIds, 'OTHER'];
                            setAnswer(question.id, { jsonValue: next });
                          }}
                          disabled={disabled || submitting}
                        />
                        <span>Other:</span>
                      </label>
                      {Array.isArray(answer.jsonValue) && (answer.jsonValue as string[]).includes('OTHER') && (
                        <input
                          type="text"
                          className="form-input"
                          style={{ flex: 1, minWidth: '160px' }}
                          placeholder="Specify other..."
                          value={answer.textValue || ''}
                          onChange={(event) => setAnswer(question.id, { textValue: event.target.value })}
                          disabled={disabled || submitting}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Dropdown */}
              {question.type === 'DROPDOWN' && (
                <select
                  className="form-select"
                  value={(answer.jsonValue as { selectedOptionId?: string } | undefined)?.selectedOptionId || ''}
                  onChange={(event) =>
                    setAnswer(question.id, {
                      jsonValue: event.target.value ? { selectedOptionId: event.target.value } : undefined,
                    })
                  }
                  disabled={disabled || submitting}
                >
                  <option value="">Choose an option...</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}

              {/* 6. File upload */}
              {question.type === 'FILE_UPLOAD' && (() => {
                const files = Array.isArray(answer.jsonValue)
                  ? (answer.jsonValue as Array<{ name: string; size: number; type: string }>)
                  : [];
                const uploadConfig = config.fileUpload;
                return (
                  <div>
                    <div style={{ border: '2px dashed var(--color-border-subtle)', padding: '1.25rem', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>📎</div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                        Upload up to {uploadConfig?.maxFiles || 1} file(s), max {(uploadConfig?.maxFileSizeMb || 10) >= 1000 ? `${(uploadConfig?.maxFileSizeMb || 1000) / 1000} GB` : `${uploadConfig?.maxFileSizeMb || 10} MB`} each.
                      </p>
                      <input
                        type="file"
                        multiple={(uploadConfig?.maxFiles || 1) > 1}
                        accept={fileAcceptAttribute(uploadConfig)}
                        disabled={disabled || submitting}
                        onChange={(event) => {
                          const selected = Array.from(event.target.files || []);
                          const fileError = validateFileSelection(selected, uploadConfig);
                          if (fileError) {
                            setErrors((prev) => ({ ...prev, [question.id]: fileError }));
                            setAnswer(question.id, { jsonValue: [] });
                            return;
                          }
                          setAnswer(question.id, {
                            jsonValue: selected.map((file) => ({ name: file.name, size: file.size, type: file.type })),
                          });
                        }}
                      />
                    </div>
                    {files.length > 0 && (
                      <ul style={{ marginTop: '0.5rem', paddingLeft: '1.1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {files.map((file, index) => (
                          <li key={`${file.name}_${index}`}>{file.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}

              {/* 7. Linear scale */}
              {question.type === 'LINEAR_SCALE' && (() => {
                const scale = config.linearScale || { min: 1, max: 5 };
                const values = Array.from({ length: scale.max - scale.min + 1 }, (_, index) => scale.min + index);
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {scale.minLabel && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{scale.minLabel}</span>}
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flex: 1, flexWrap: 'wrap' }}>
                        {values.map((value) => (
                          <label key={value} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                            <span style={{ fontSize: '0.85rem' }}>{value}</span>
                            <input
                              type="radio"
                              name={`scale_${question.id}`}
                              checked={answer.ratingValue === value}
                              onChange={() => setAnswer(question.id, { ratingValue: value, jsonValue: value })}
                              disabled={disabled || submitting}
                            />
                          </label>
                        ))}
                      </div>
                      {scale.maxLabel && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{scale.maxLabel}</span>}
                    </div>
                  </div>
                );
              })()}

              {/* 8. Rating */}
              {(question.type === 'RATING' || question.type === 'RATING_5') && (() => {
                const rating = config.rating || { maxRating: 5, icon: 'STAR' as const };
                const hovered = hoverRating[question.id] ?? null;
                const selected = answer.ratingValue ?? null;
                const active = hovered ?? selected ?? 0;
                return (
                  <div
                    style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}
                    onMouseLeave={() => setHoverRating((prev) => ({ ...prev, [question.id]: null }))}
                  >
                    {Array.from({ length: rating.maxRating }, (_, index) => index + 1).map((value) => {
                      const isLit = value <= active;
                      return (
                        <button
                          key={value}
                          type="button"
                          data-rating={value}
                          onMouseEnter={() => setHoverRating((prev) => ({ ...prev, [question.id]: value }))}
                          onClick={() => setAnswer(question.id, { ratingValue: value, jsonValue: value })}
                          disabled={disabled || submitting}
                          title={`${value} of ${rating.maxRating}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.1rem',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            backgroundColor: isLit ? '#fffbeb' : 'transparent',
                            border: `1px solid ${isLit ? '#fcd34d' : 'var(--color-border-subtle)'}`,
                            transition: 'background-color 0.12s ease, border-color 0.12s ease',
                          }}
                        >
                          <Icon kind={rating.icon} filled={isLit} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{value}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* 9. Multiple choice grid */}
              {question.type === 'MULTIPLE_CHOICE_GRID' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }} />
                        {columns.map((column) => (
                          <th key={column.id} style={{ padding: '0.5rem', fontSize: '0.8rem' }}>{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.9rem' }}>{row.label}</td>
                          {columns.map((column) => (
                            <td key={column.id} style={{ padding: '0.5rem' }}>
                              <input
                                type="radio"
                                name={`grid_${question.id}_${row.id}`}
                                checked={((answer.jsonValue as Record<string, string>) || {})[row.id] === column.id}
                                onChange={() => {
                                  const next = { ...((answer.jsonValue as Record<string, string>) || {}), [row.id]: column.id };
                                  if (config.grid?.limitOnePerColumn) {
                                    for (const key of Object.keys(next)) {
                                      if (key !== row.id && next[key] === column.id) delete next[key];
                                    }
                                  }
                                  setAnswer(question.id, { jsonValue: next });
                                }}
                                disabled={disabled || submitting}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 10. Checkbox grid */}
              {question.type === 'CHECKBOX_GRID' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }} />
                        {columns.map((column) => (
                          <th key={column.id} style={{ padding: '0.5rem', fontSize: '0.8rem' }}>{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const map = (answer.jsonValue as Record<string, string[]>) || {};
                        return (
                          <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                            <td style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.9rem' }}>{row.label}</td>
                            {columns.map((column) => {
                              const selected = (map[row.id] || []).includes(column.id);
                              return (
                                <td key={column.id} style={{ padding: '0.5rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => {
                                      const next: Record<string, string[]> = { ...map };
                                      const rowValues = [...(next[row.id] || [])];
                                      next[row.id] = selected
                                        ? rowValues.filter((id) => id !== column.id)
                                        : [...rowValues, column.id];
                                      if (!selected && config.grid?.limitOnePerColumn) {
                                        for (const key of Object.keys(next)) {
                                          if (key !== row.id) {
                                            next[key] = (next[key] || []).filter((id) => id !== column.id);
                                          }
                                        }
                                      }
                                      setAnswer(question.id, { jsonValue: next });
                                    }}
                                    disabled={disabled || submitting}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 11. Date */}
              {question.type === 'DATE' && (() => {
                const includeYear = config.date?.includeYear !== false;
                const includeTime = !!config.date?.includeTime;
                const value = answer.textValue || '';
                const [datePart = '', timePart = ''] = value.split('T');
                const dateSegments = datePart.split('-');
                const month = includeYear ? dateSegments[1] || '' : dateSegments[0] || '';
                const day = includeYear ? dateSegments[2] || '' : dateSegments[1] || '';
                const year = includeYear ? dateSegments[0] || '' : '';
                const compose = (nextYear: string, nextMonth: string, nextDay: string, nextTime: string) => {
                  if (!nextMonth || !nextDay) return '';
                  const base = includeYear ? `${nextYear || '2026'}-${nextMonth}-${nextDay}` : `${nextMonth}-${nextDay}`;
                  return includeTime && nextTime ? `${base}T${nextTime}` : base;
                };
                return (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {includeYear && (
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '110px' }}
                        placeholder="YYYY"
                        value={year}
                        onChange={(event) => setAnswer(question.id, { textValue: compose(event.target.value, month, day, timePart) })}
                        disabled={disabled || submitting}
                      />
                    )}
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: '90px' }}
                      placeholder="MM"
                      min={1}
                      max={12}
                      value={month}
                      onChange={(event) => setAnswer(question.id, { textValue: compose(year, event.target.value.padStart(2, '0'), day, timePart) })}
                      disabled={disabled || submitting}
                    />
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: '90px' }}
                      placeholder="DD"
                      min={1}
                      max={31}
                      value={day}
                      onChange={(event) => setAnswer(question.id, { textValue: compose(year, month, event.target.value.padStart(2, '0'), timePart) })}
                      disabled={disabled || submitting}
                    />
                    {includeTime && (
                      <input
                        type="time"
                        className="form-input"
                        style={{ width: '130px' }}
                        value={timePart}
                        onChange={(event) => setAnswer(question.id, { textValue: compose(year, month, day, event.target.value) })}
                        disabled={disabled || submitting}
                      />
                    )}
                  </div>
                );
              })()}

              {/* 12. Time */}
              {question.type === 'TIME' && (() => {
                const duration = config.time?.mode === 'DURATION';
                const value = answer.textValue || '';
                if (!duration) {
                  return (
                    <input
                      type="time"
                      className="form-input"
                      value={value}
                      onChange={(event) => setAnswer(question.id, { textValue: event.target.value })}
                      disabled={disabled || submitting}
                    />
                  );
                }
                const [hours = '', minutes = '', seconds = ''] = value.split(':');
                const compose = (h: string, m: string, s: string) =>
                  h === '' && m === '' && s === '' ? '' : `${h || '0'}:${(m || '00').padStart(2, '0')}:${(s || '00').padStart(2, '0')}`;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: '90px' }}
                      placeholder="HH"
                      min={0}
                      value={hours}
                      onChange={(event) => setAnswer(question.id, { textValue: compose(event.target.value, minutes, seconds) })}
                      disabled={disabled || submitting}
                    />
                    <span>:</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: '90px' }}
                      placeholder="MM"
                      min={0}
                      max={59}
                      value={minutes}
                      onChange={(event) => setAnswer(question.id, { textValue: compose(hours, event.target.value, seconds) })}
                      disabled={disabled || submitting}
                    />
                    <span>:</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: '90px' }}
                      placeholder="SS"
                      min={0}
                      max={59}
                      value={seconds}
                      onChange={(event) => setAnswer(question.id, { textValue: compose(hours, minutes, event.target.value) })}
                      disabled={disabled || submitting}
                    />
                  </div>
                );
              })()}

              {error && (
                <div style={{ color: 'var(--color-error)', fontSize: '0.825rem', marginTop: '0.5rem' }} role="alert">
                  ⚠ {error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        {visitedStack.length > 0 ? (
          <button type="button" onClick={handleBack} className="btn-outline" disabled={submitting}>
            ← Back
          </button>
        ) : (
          <div />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-outline" disabled={submitting}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={submitting || disabled}>
            {submitting ? 'Submitting...' : isSubmitAction ? (mode === 'preview' ? 'Submit (Simulated)' : 'Submit') : 'Next →'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default FormRenderer;
