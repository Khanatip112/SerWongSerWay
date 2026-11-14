import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header
      style={{
        backgroundColor: 'var(--color-brand-pastel)',
        borderBottom: '1px solid var(--color-border-subtle)',
        padding: '0.875rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Link
          to={user ? '/campaigns' : '/login'}
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          PastelPulse
        </Link>
        <span
          style={{
            fontSize: '0.85rem',
            color: 'var(--color-text-muted)',
            fontWeight: 500,
          }}
        >
          Review & Survey System
        </span>
      </div>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {user.fullName}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              ({user.email})
            </span>
            <span
              className={`badge ${
                user.role === 'CREATOR' ? 'badge-creator' : 'badge-respondent'
              }`}
            >
              {user.role}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="btn-outline"
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.85rem',
              backgroundColor: '#ffffff',
            }}
          >
            Log out
          </button>
        </div>
      )}
    </header>
  );
};

export default Navbar;
