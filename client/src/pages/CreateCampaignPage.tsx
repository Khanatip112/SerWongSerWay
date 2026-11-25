import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/Alert.js';
import {
  ContentBlock,
  QuestionConfig,
  QuestionImageConfig,
  QuestionType,
  Section,
} from '../types/index.js';

interface EditableQuestion {
  id?: string;
  sectionId?: string | null;
  prompt: string;
  description?: string | null;
  type: QuestionType;
  required: boolean;
  orderIndex?: number;
  config?: QuestionConfig | null;
  image?: QuestionImageConfig | null;
}

const QUESTION_TYPE_LABELS: Array<{ value: QuestionType; label: string }> = [
  { value: 'RATING_5', label: '1–5 Star Rating (Numeric)' },
  { value: 'TEXT', label: 'Open-ended Text Feedback' },
];

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const CreateCampaignPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [questions, setQuestions] = useState<EditableQuestion[]>(
    isEditing ? [] : [{ prompt: 'Overall satisfaction', type: 'RATING_5', required: true }]
  );
  const [loadingDraft, setLoadingDraft] = useState(isEditing);
  const [error, setError] = useState('');
  const [submittingAction, setSubmittingAction] = useState<'DRAFT' | 'PUBLISHED' | null>(null);

  const minDateTime = toLocalDateTimeInput(new Date());

  useEffect(() => {
    if (!id) return;

    const loadDraft = async () => {
      setLoadingDraft(true);
      setError('');
      try {
        const res = await fetch(`/api/campaigns/${id}`);
        const body = await res.json();
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            navigate('/campaigns', {
              replace: true,
              state: {
                accessError:
                  body.error?.message ||
                  'Access denied: you do not have permission to edit this survey.',
              },
            });
            return;
          }
          setError(body.error?.message || 'Failed to load survey draft.');
          return;
        }
        const data = body.data;
        setTitle(data.title || '');
        setDescription(data.description || '');
        setClosesAt(data.closesAt ? toLocalDateTimeInput(new Date(data.closesAt)) : '');
        setSections(data.sections || []);
        setContentBlocks(data.contentBlocks || []);
        setQuestions(
          (data.questions || []).map((q: EditableQuestion) => ({
            id: q.id,
            sectionId: q.sectionId ?? null,
            prompt: q.prompt || '',
            description: q.description ?? null,
            type: q.type,
            required: q.required,
            orderIndex: q.orderIndex,
            config: q.config ?? undefined,
            image: q.image ?? undefined,
          }))
        );
      } catch {
        setError('Network error loading survey draft.');
      } finally {
        setLoadingDraft(false);
      }
    };

    loadDraft();
  }, [id]);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { prompt: '', type: 'TEXT', required: true },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (
    index: number,
    field: keyof EditableQuestion,
    value: string | boolean
  ) => {
    const updated = [...questions];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setQuestions(updated);
  };

  const saveSurvey = async (targetStatus: 'DRAFT' | 'PUBLISHED') => {
    setError('');

    if (!title.trim()) {
      setError('Survey title is required.');
      return;
    }

    if (targetStatus === 'PUBLISHED' && !closesAt) {
      setError('Closing deadline is required to publish a survey.');
      return;
    }

    if (closesAt) {
      const deadline = new Date(closesAt);
      if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
        setError('Closing deadline must be in the future.');
        return;
      }
    }

    let questionsToSubmit = questions;

    if (targetStatus === 'PUBLISHED') {
      if (questions.length === 0) {
        setError('At least one question is required to publish a survey.');
        return;
      }
      const hasEmptyPrompt = questions.some((q) => !q.prompt.trim());
      if (hasEmptyPrompt) {
        setError('Please fill in the prompt for all questions or remove empty ones before publishing.');
        return;
      }
    } else {
      questionsToSubmit = questions.filter((q) => q.prompt.trim() !== '');
    }

    setSubmittingAction(targetStatus);

    try {
      const endpoint = isEditing ? `/api/campaigns/${id}` : '/api/campaigns';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          status: targetStatus,
          closesAt: closesAt ? new Date(closesAt).toISOString() : null,
          sections,
          contentBlocks,
          questions: questionsToSubmit.map((q, index) => ({
            ...(q.id ? { id: q.id } : {}),
            ...(q.sectionId ? { sectionId: q.sectionId } : {}),
            prompt: q.prompt.trim(),
            ...(q.description ? { description: q.description } : {}),
            type: q.type,
            required: q.required,
            orderIndex: index,
            ...(q.config ? { config: q.config } : {}),
            ...(q.image !== undefined ? { image: q.image } : {}),
          })),
        }),
      });

      const body = await res.json();
      if (res.ok) {
        navigate('/campaigns');
      } else {
        setError(body.error?.message || 'Failed to save survey.');
      }
    } catch {
      setError('Network error saving survey.');
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSurvey('PUBLISHED');
  };

  if (loadingDraft) {
    return (
      <div className="container" style={{ width: '100%', maxWidth: '720px', boxSizing: 'border-box' }}>
        <div className="card" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '3rem' }}>
          <div style={{ color: 'var(--color-text-muted)' }}>Loading survey draft...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ width: '100%', maxWidth: '720px', boxSizing: 'border-box' }}>
      <div className="card" style={{ width: '100%', boxSizing: 'border-box' }}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            color: 'var(--color-text-primary)',
          }}
        >
          {isEditing ? 'Edit Survey Draft' : 'Create New Survey'}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Configure details and questions for respondent feedback collection.
        </p>

        {error && <Alert type="error" message={error} />}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">
              Survey Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. End of Semester Workshop Feedback"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              className="form-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the purpose of this survey..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="closesAt">
              Closing Deadline *
            </label>
            <input
              id="closesAt"
              name="closesAt"
              type="datetime-local"
              min={minDateTime}
              className="form-input"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>

          {sections.length > 1 && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-page)',
                border: '1px solid var(--color-border-subtle)',
                marginBottom: '1.25rem',
                fontSize: '0.85rem',
                color: 'var(--color-text-muted)',
              }}
            >
              Sections in this draft: {sections.map((s) => s.title).join(' → ')}
            </div>
          )}

          {/* Questions Section */}
          <div style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Survey Questions</h2>
              <button
                type="button"
                className="btn-pastel"
                onClick={handleAddQuestion}
              >
                + Add Question
              </button>
            </div>

            {questions.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'var(--color-bg-page)',
                  border: '1px dashed var(--color-border-subtle)',
                  borderRadius: '6px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.9rem',
                }}
              >
                No questions added yet. You can save this as a draft or click &ldquo;+ Add Question&rdquo; to add questions before publishing.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    style={{
                      backgroundColor: 'var(--color-bg-page)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: '6px',
                      padding: '1rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        Question {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(idx)}
                        style={{
                          color: 'var(--color-error)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <input
                        name={`questions[${idx}].prompt`}
                        type="text"
                        className="form-input"
                        value={q.prompt}
                        onChange={(e) => handleQuestionChange(idx, 'prompt', e.target.value)}
                        placeholder="e.g. Overall satisfaction"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 180px' }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>
                          Question Type
                        </label>
                        <select
                          className="form-select"
                          value={q.type}
                          onChange={(e) =>
                            handleQuestionChange(idx, 'type', e.target.value as QuestionType)
                          }
                        >
                          {QUESTION_TYPE_LABELS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.25rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) => handleQuestionChange(idx, 'required', e.target.checked)}
                          />
                          Required question
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate('/campaigns')}
              disabled={submittingAction !== null}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-pastel"
              onClick={() => saveSurvey('DRAFT')}
              disabled={submittingAction !== null}
            >
              {submittingAction === 'DRAFT' ? 'Saving Draft...' : 'Save Draft'}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submittingAction !== null}
            >
              {submittingAction === 'PUBLISHED' ? 'Publishing...' : 'Publish Survey'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCampaignPage;
