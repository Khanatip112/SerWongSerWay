import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.js';
import { QuestionType } from '../types/index.js';

interface NewQuestion {
  prompt: string;
  type: QuestionType;
  required: boolean;
}

export const CreateCampaignPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [questions, setQuestions] = useState<NewQuestion[]>([
    { prompt: 'Overall satisfaction', type: 'RATING_5', required: true },
  ]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { prompt: '', type: 'TEXT', required: true },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (
    index: number,
    field: keyof NewQuestion,
    value: string | boolean
  ) => {
    const updated = [...questions];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Campaign title is required.');
      return;
    }

    // Blank question rows are discarded so an unfinished row never blocks publishing.
    const completedQuestions = questions.filter((q) => q.prompt.trim() !== '');

    if (completedQuestions.length === 0) {
      setError('At least one question with a prompt is required.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          closesAt: closesAt ? new Date(closesAt).toISOString() : null,
          questions: completedQuestions.map((q) => ({
            prompt: q.prompt.trim(),
            type: q.type,
            required: q.required,
          })),
        }),
      });

      const body = await res.json();
      if (res.ok) {
        navigate('/campaigns');
      } else {
        setError(body.error?.message || 'Failed to create campaign.');
      }
    } catch {
      setError('Network error creating campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '720px' }}>
      <div className="card">
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            color: 'var(--color-text-primary)',
          }}
        >
          Create New Survey Campaign
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Configure campaign details and questions for respondent feedback collection.
        </p>

        {error && <Alert type="error" message={error} />}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">
              Campaign Title *
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
              placeholder="Explain the purpose of this review campaign..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="closesAt">
              Closing Deadline (Optional)
            </label>
            <input
              id="closesAt"
              name="closesAt"
              type="datetime-local"
              className="form-input"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>

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
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              Questions left without a prompt are ignored when publishing.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {questions.map((q, idx) => (
                <div
                  key={idx}
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
                    {questions.length > 1 && (
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
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      Prompt *
                    </label>
                    <input
                      name={`questions[${idx}].prompt`}
                      type="text"
                      className="form-input"
                      value={q.prompt}
                      onChange={(e) => handleQuestionChange(idx, 'prompt', e.target.value)}
                      placeholder="e.g. Overall satisfaction rating"
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
                        <option value="RATING_5">1–5 Star Rating (Numeric)</option>
                        <option value="TEXT">Open-ended Text Feedback</option>
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
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate('/campaigns')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Publishing...' : 'Publish Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCampaignPage;
