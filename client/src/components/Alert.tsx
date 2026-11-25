import React from 'react';

interface AlertProps {
  type?: 'error' | 'success' | 'warning';
  message: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ type = 'error', message, onClose }) => {
  if (!message) return null;

  const className =
    type === 'error'
      ? 'alert alert-error error-banner'
      : type === 'success'
      ? 'alert alert-success'
      : 'alert alert-warning';

  return (
    <div role="alert" className={className} style={{ width: '100%', boxSizing: 'border-box' }}>
      <span>{type === 'error' ? '⚠️' : type === 'success' ? '✓' : 'ℹ'}</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          style={{
            marginLeft: 'auto',
            fontSize: '1.1rem',
            lineHeight: 1,
            fontWeight: 700,
            color: 'inherit',
            padding: '0 0.25rem',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Alert;
