import React from 'react';

interface AlertProps {
  type?: 'error' | 'success' | 'warning';
  message: string;
}

export const Alert: React.FC<AlertProps> = ({ type = 'error', message }) => {
  if (!message) return null;

  const className =
    type === 'error'
      ? 'alert alert-error error-banner'
      : type === 'success'
      ? 'alert alert-success'
      : 'alert alert-warning';

  return (
    <div role="alert" className={className}>
      <span>{type === 'error' ? '⚠️' : type === 'success' ? '✓' : 'ℹ'}</span>
      <span>{message}</span>
    </div>
  );
};

export default Alert;
