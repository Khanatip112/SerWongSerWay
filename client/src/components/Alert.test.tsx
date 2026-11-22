import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Alert from './Alert.js';

describe('Alert', () => {
  it('renders an error alert by default', () => {
    const markup = renderToStaticMarkup(<Alert message="Save failed" />);

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('class="alert alert-error error-banner"');
    expect(markup).toContain('Save failed');
  });

  it.each([
    ['success', 'alert alert-success'],
    ['warning', 'alert alert-warning'],
  ] as const)('renders the %s style', (type, className) => {
    const markup = renderToStaticMarkup(<Alert type={type} message="Status update" />);

    expect(markup).toContain(`class="${className}"`);
    expect(markup).toContain('Status update');
  });

  it('renders nothing when the message is empty', () => {
    expect(renderToStaticMarkup(<Alert message="" />)).toBe('');
  });
});
