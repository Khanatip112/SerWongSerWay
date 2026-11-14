import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import Alert from '../components/Alert.js';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(email, password);
    setSubmitting(false);

    if (result.success) {
      navigate('/campaigns');
    } else {
      setError(result.error || 'Invalid email or password.');
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError('');
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 70px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            Welcome to PastelPulse
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Sign in to access review surveys and feedback campaigns.
          </p>
        </div>

        {error && <Alert type="error" message={error} />}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. creator1@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--color-border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              marginBottom: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Quick Demo Logins
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-pastel"
              onClick={() => handleQuickFill('creator1@example.com')}
              style={{ flex: '1 1 auto', fontSize: '0.825rem' }}
            >
              Creator 1 (Owner)
            </button>
            <button
              type="button"
              className="btn-pastel"
              onClick={() => handleQuickFill('creator2@example.com')}
              style={{ flex: '1 1 auto', fontSize: '0.825rem' }}
            >
              Creator 2
            </button>
            <button
              type="button"
              className="btn-pastel"
              onClick={() => handleQuickFill('respondent1@example.com')}
              style={{ flex: '1 1 auto', fontSize: '0.825rem' }}
            >
              Respondent 1
            </button>
            <button
              type="button"
              className="btn-pastel"
              onClick={() => handleQuickFill('respondent2@example.com')}
              style={{ flex: '1 1 auto', fontSize: '0.825rem' }}
            >
              Respondent 2
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
