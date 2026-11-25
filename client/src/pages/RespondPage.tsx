import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.js';
import FormRenderer, { AnswerPayload } from '../components/FormRenderer.js';
import { AnswerItem, Campaign, Question } from '../types/index.js';

function renderReadOnlyAnswer(question: Question, answer?: AnswerItem): React.ReactNode {
  if (!answer) {
    return (
      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
        No response provided
      </span>
    );
  }

  const config = question.config || {};

  if (question.type === 'RATING_5' || question.type === 'RATING') {
    const maxRating = config.rating?.maxRating || 5;
    const icon =
      config.rating?.icon === 'HEART'
        ? '♥'
        : config.rating?.icon === 'THUMBS_UP'
          ? '👍'
          : '★';
    const val = answer.ratingValue ?? (typeof answer.jsonValue === 'number' ? answer.jsonValue : null);
    if (val === null || val === undefined) {
      return (
        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          No response provided
        </span>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          {Array.from({ length: maxRating }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              style={{
                fontSize: '1.25rem',
                color: n <= val ? '#eab308' : 'var(--color-border-subtle)',
              }}
            >
              {icon}
            </span>
          ))}
        </div>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
          {val} / {maxRating}
        </span>
      </div>
    );
  }

  if (question.type === 'LINEAR_SCALE') {
    const min = config.linearScale?.min ?? 1;
    const max = config.linearScale?.max ?? 5;
    const val = answer.ratingValue ?? (typeof answer.jsonValue === 'number' ? answer.jsonValue : null);
    if (val === null || val === undefined) {
      return (
        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          No response provided
        </span>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
          {val} / {max}
        </span>
        {(config.linearScale?.minLabel || config.linearScale?.maxLabel) && (
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            ({config.linearScale?.minLabel || min} → {config.linearScale?.maxLabel || max})
          </span>
        )}
      </div>
    );
  }

  if (question.type === 'MULTIPLE_CHOICE_GRID' || question.type === 'CHECKBOX_GRID') {
    const rows = config.grid?.rows || [];
    const columns = config.grid?.columns || [];
    const record =
      typeof answer.jsonValue === 'object' && answer.jsonValue !== null && !Array.isArray(answer.jsonValue)
        ? (answer.jsonValue as Record<string, unknown>)
        : {};
    const colLabel = (colId: string) => columns.find((c) => c.id === colId)?.label || colId;

    if (rows.length > 0 && Object.keys(record).length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {rows.map((row) => {
            const raw = record[row.id];
            const selected = Array.isArray(raw)
              ? raw.map((id) => colLabel(String(id))).join(', ')
              : typeof raw === 'string' && raw
                ? colLabel(raw)
                : '';
            return (
              <div key={row.id} style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                <strong>{row.label}:</strong>{' '}
                {selected || (
                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>
                )}
              </div>
            );
          })}
        </div>
      );
    }
  }

  const displayText =
    answer.formattedAnswer ||
    (typeof answer.textValue === 'string' && answer.textValue.trim() ? answer.textValue : '') ||
    (typeof answer.jsonValue === 'string' && answer.jsonValue.trim() ? answer.jsonValue : '');

  if (!displayText) {
    return (
      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
        No response provided
      </span>
    );
  }

  return (
    <div style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
      {displayText}
    </div>
  );
}

export const RespondPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCampaign = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/campaigns/${id}`);
        const body = await res.json();
        if (res.ok) {
          setCampaign(body.data);
          if (body.data.hasSubmitted) {
            setError('You have already submitted a response to this survey.');
          }
        } else if (res.status === 403 || res.status === 404) {
          navigate('/campaigns', {
            replace: true,
            state: {
              accessError:
                body.error?.message ||
                'Access denied: this survey is not open for responses.',
            },
          });
          return;
        } else {
          setError(body.error?.message || 'Failed to load survey details.');
        }
      } catch {
        setError('Network error loading survey.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [id, navigate]);

  const handleFormSubmit = async (payloadAnswers: AnswerPayload[]): Promise<boolean> => {
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch(`/api/campaigns/${id}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payloadAnswers }),
      });

      const body = await res.json();
      if (res.ok) {
        setSuccess('Your response has been submitted successfully! Thank you for your feedback.');
        return true;
      }
      setError(body.error?.message || 'Failed to submit response.');
      return false;
    } catch {
      setError('Network error submitting feedback.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ width: '100%', maxWidth: '720px', boxSizing: 'border-box' }}>
        <div className="card" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '3rem' }}>
          <div style={{ color: 'var(--color-text-muted)' }}>Loading survey...</div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container" style={{ width: '100%', maxWidth: '720px', boxSizing: 'border-box' }}>
        <div className="card" style={{ width: '100%', boxSizing: 'border-box' }}>
          <Alert type="error" message={error || 'Survey not found.'} />
          <Link to="/campaigns" className="btn-outline">
            ← Back to Surveys
          </Link>
        </div>
      </div>
    );
  }

  const orderedQuestions = (() => {
    const sectionOrder = new Map((campaign.sections || []).map((s) => [s.id, s.orderIndex]));
    return [...(campaign.questions || [])].sort((a, b) => {
      const secDiff =
        (a.sectionId ? sectionOrder.get(a.sectionId) ?? 0 : 0) -
        (b.sectionId ? sectionOrder.get(b.sectionId) ?? 0 : 0);
      if (secDiff !== 0) return secDiff;
      return a.orderIndex - b.orderIndex;
    });
  })();

  const answerByQuestionId = new Map<string, AnswerItem>();
  (campaign.mySubmission?.answers || []).forEach((ans) => {
    if (ans.questionId) {
      answerByQuestionId.set(ans.questionId, ans);
    }
  });

  return (
    <div className="container" style={{ width: '100%', maxWidth: '720px', boxSizing: 'border-box' }}>
      <div className="card" style={{ width: '100%', boxSizing: 'border-box', padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {campaign.title}
            </h1>
            <span
              className={`badge ${
                campaign.status === 'PUBLISHED' ? 'badge-published' : 'badge-closed'
              }`}
            >
              {campaign.status}
            </span>
          </div>

          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
            {campaign.description}
          </p>
        </div>

        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}

        {success ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>
              Your feedback has been recorded in the database.
            </p>
            <Link to="/campaigns" className="btn-primary">
              Browse More Surveys
            </Link>
          </div>
        ) : campaign.hasSubmitted ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Your Submitted Responses
              </h2>
              {campaign.mySubmission?.submittedAt && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Submitted on{' '}
                  {new Date(campaign.mySubmission.submittedAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {orderedQuestions.map((q, idx) => {
                const ans = answerByQuestionId.get(q.id);
                return (
                  <div
                    key={q.id}
                    style={{
                      padding: '1rem 1.25rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bg-page)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--color-text-muted)',
                          textTransform: 'uppercase',
                        }}
                      >
                        Question {idx + 1}
                      </span>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '0.15rem' }}>
                        {q.prompt}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '0.625rem 0.75rem',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      {renderReadOnlyAnswer(q, ans)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Link to="/campaigns" className="btn-outline">
                ← Back to Surveys
              </Link>
            </div>
          </div>
        ) : (
          <FormRenderer
            campaign={campaign}
            mode="live"
            onSubmit={handleFormSubmit}
            onCancel={() => navigate('/campaigns')}
            submitting={submitting}
            externalError={error}
          />
        )}
      </div>
    </div>
  );
};

export default RespondPage;
