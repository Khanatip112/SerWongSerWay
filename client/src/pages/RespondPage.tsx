import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Alert from '../components/Alert.js';
import { Campaign } from '../types/index.js';

export const RespondPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form answer state: questionId -> { ratingValue?: number, textValue?: string }
  const [answers, setAnswers] = useState<Record<string, { ratingValue?: number; textValue?: string }>>({});

  useEffect(() => {
    const fetchCampaign = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/campaigns/${id}`);
        const body = await res.json();
        if (res.ok) {
          setCampaign(body.data);
          // Initialize answers map
          const initialAnswers: Record<string, { ratingValue?: number; textValue?: string }> = {};
          body.data.questions?.forEach((q: { id: string; type: string }) => {
            initialAnswers[q.id] = {
              ratingValue: q.type === 'RATING_5' ? 5 : undefined,
              textValue: q.type === 'TEXT' ? '' : undefined,
            };
          });
          setAnswers(initialAnswers);
          if (body.data.hasSubmitted) {
            setError('You have already submitted a response to this campaign.');
          }
        } else {
          setError(body.error?.message || 'Failed to load campaign details.');
        }
      } catch {
        setError('Network error loading survey.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [id]);

  const handleRatingSelect = (questionId: string, rating: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        ratingValue: rating,
      },
    }));
  };

  const handleTextChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        textValue: text,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!campaign) return;

    // Validate required questions
    for (const q of campaign.questions || []) {
      const ans = answers[q.id];
      if (q.required) {
        if (q.type === 'RATING_5' && (!ans || !ans.ratingValue)) {
          setError(`Please select a rating for "${q.prompt}".`);
          return;
        }
        if (q.type === 'TEXT' && (!ans || !ans.textValue?.trim())) {
          setError(`Please enter your feedback for "${q.prompt}".`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const payloadAnswers = Object.entries(answers).map(([questionId, ans]) => ({
        questionId,
        ratingValue: ans.ratingValue ?? null,
        textValue: ans.textValue ?? null,
      }));

      const res = await fetch(`/api/campaigns/${id}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payloadAnswers }),
      });

      const body = await res.json();
      if (res.ok) {
        setSuccess('Your response has been submitted successfully! Thank you for your feedback.');
      } else {
        setError(body.error?.message || 'Failed to submit response.');
      }
    } catch {
      setError('Network error submitting feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ maxWidth: '640px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ color: 'var(--color-text-muted)' }}>Loading survey...</div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container" style={{ maxWidth: '640px' }}>
        <div className="card">
          <Alert type="error" message={error || 'Campaign not found.'} />
          <Link to="/campaigns" className="btn-outline">
            ← Back to Campaigns
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '680px' }}>
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
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
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', marginBottom: '2rem' }}>
              {campaign.questions?.map((q, idx) => {
                const currentAns = answers[q.id] || {};

                return (
                  <div
                    key={q.id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-bg-page)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Question {idx + 1} {q.required && <span style={{ color: 'var(--color-error)' }}>*</span>}
                      </span>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>
                        {q.prompt}
                      </h3>
                    </div>

                    {q.type === 'RATING_5' ? (
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          {[1, 2, 3, 4, 5].map((star) => {
                            const isSelected = currentAns.ratingValue === star;
                            return (
                              <button
                                key={star}
                                type="button"
                                data-rating={star}
                                onClick={() => handleRatingSelect(q.id, star)}
                                style={{
                                  flex: '1',
                                  padding: '0.625rem',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  fontSize: '1rem',
                                  backgroundColor: isSelected ? 'var(--color-brand-pastel)' : '#ffffff',
                                  border: `2px solid ${isSelected ? 'var(--color-text-primary)' : 'var(--color-border-subtle)'}`,
                                  color: 'var(--color-text-primary)',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {star} ★
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                          <span>1 - Poor</span>
                          <span>5 - Excellent</span>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={currentAns.textValue || ''}
                        onChange={(e) => handleTextChange(q.id, e.target.value)}
                        placeholder="Type your response here..."
                        required={q.required}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link to="/campaigns" className="btn-outline">
                ← Back
              </Link>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting || campaign.status !== 'PUBLISHED'}
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RespondPage;
