import React, { useEffect, useState } from 'react';

interface SystemStatus {
  health: string;
  ready: boolean;
  database: string;
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus>({
    health: 'checking...',
    ready: false,
    database: 'checking...',
  });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((healthData) => {
        return fetch('/api/ready')
          .then((res) => res.json())
          .then((readyData) => {
            setStatus({
              health: healthData.status || 'unknown',
              ready: readyData.status === 'ready',
              database: readyData.database || 'disconnected',
            });
          });
      })
      .catch(() => {
        setStatus({
          health: 'error connecting',
          ready: false,
          database: 'unreachable',
        });
      });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          backgroundColor: 'var(--color-brand-pastel)',
          borderBottom: '1px solid var(--color-border-subtle)',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          PastelPulse
        </h1>
        <span
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-muted)',
            fontWeight: 500,
          }}
        >
          Review & Survey System
        </span>
      </header>

      <main style={{ flex: 1, padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div
          style={{
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '8px',
            padding: '2rem',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          }}
        >
          <h2 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
            System Scaffold & Initialization
          </h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            PastelPulse is configured with high-contrast Pastel Pink tokens and ready for Sprint 1 services.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                flex: '1 1 200px',
                padding: '1rem',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-page)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Backend Health</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {status.health}
              </div>
            </div>

            <div
              style={{
                flex: '1 1 200px',
                padding: '1rem',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-page)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Database Connection</div>
              <div
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: status.ready ? 'var(--color-success)' : 'var(--color-error)',
                }}
              >
                {status.database}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '1rem',
              borderRadius: '6px',
              backgroundColor: status.ready ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
              border: `1px solid ${status.ready ? 'var(--color-success)' : 'var(--color-error)'}`,
              color: status.ready ? 'var(--color-success)' : 'var(--color-error)',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            {status.ready
              ? '✓ System is ready. PostgreSQL database connected via Prisma.'
              : 'System readiness pending connection to database service.'}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
