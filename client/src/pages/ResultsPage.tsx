import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.js';
import { CampaignResults } from '../types/index.js';

export const ResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [results, setResults] = useState<CampaignResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/campaigns/${id}/results`);
        const body = await res.json();
        if (res.ok) {
          setResults(body.data);
        } else if (res.status === 403 || res.status === 404) {
          navigate('/campaigns', {
            replace: true,
            state: {
              accessError:
                body.error?.message ||
                'Access denied: only the survey owner can view these responses.',
            },
          });
          return;
        } else {
          setError(body.error?.message || 'Failed to load survey results.');
        }
      } catch {
        setError('Network error fetching results.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="container" style={{ width: '100%', maxWidth: '860px', boxSizing: 'border-box' }}>
        <div className="card" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '3rem' }}>
          <div style={{ color: 'var(--color-text-muted)' }}>Loading results...</div>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="container" style={{ width: '100%', maxWidth: '860px', boxSizing: 'border-box' }}>
        <div className="card" style={{ width: '100%', boxSizing: 'border-box' }}>
          <Alert type="error" message={error || 'Unable to load results.'} />
          <Link to="/campaigns" className="btn-outline">
            ← Back to Surveys
          </Link>
        </div>
      </div>
    );
  }

  const { campaign, summary, submissions } = results;

  return (
    <div className="container results-card" style={{ width: '100%', maxWidth: '860px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1.5rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ flex: '1 1 320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
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
            Analytics and itemized respondent submissions.
          </p>
        </div>

        <Link
          to="/campaigns"
          className="btn-outline"
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          ← Back to Surveys
        </Link>
      </div>

      {/* KPI Summary Cards */}
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div
          className="card"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            borderLeft: '4px solid var(--color-brand-pastel)',
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Total Submissions
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>
            {summary.totalSubmissions}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Verified unique respondents
          </div>
        </div>

        <div
          className="card"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            borderLeft: '4px solid #f4c2c7',
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Average Star Rating
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {summary.averageRating > 0 ? `${summary.averageRating} / 5` : 'N/A'}
            <span style={{ fontSize: '1.25rem', color: '#eab308' }}>★</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Across all rating questions
          </div>
        </div>
      </div>

      {/* Submissions Section */}
      <div style={{ width: '100%', boxSizing: 'border-box' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
          Individual Submissions ({submissions.length})
        </h2>

        {submissions.length === 0 ? (
          <div className="card" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--color-text-muted)' }}>
              No feedback submissions received yet for this survey.
            </p>
          </div>
        ) : (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {submissions.map((sub, idx) => (
              <div key={sub.id || idx} className="card" style={{ width: '100%', boxSizing: 'border-box' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    paddingBottom: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                      {sub.respondentName}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                      (Verified Respondent)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {new Date(sub.submittedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {sub.answers.map((ans, aIdx) => (
                    <div
                      key={aIdx}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-bg-page)',
                        border: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                        {ans.questionPrompt}
                      </div>

                      {ans.type === 'RATING_5' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            {ans.ratingValue}
                          </span>
                          <span style={{ color: '#eab308', fontSize: '1.1rem' }}>★</span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>/ 5</span>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                          {ans.formattedAnswer || ans.textValue || (
                            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No response provided</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPage;
