/**
 * Server-side HTML Sanitizer for Rich Text formatting (XSS Prevention)
 * Strictly allowlists safe markup: <b>, <strong>, <i>, <em>, <u>, <a href="..." target="_blank" rel="noopener noreferrer">, <br>, <p>
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  const cleaned = rawHtml
    // Strip dangerous tags completely including their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    // Strip inline event handlers like onclick=, onerror=
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^>\s]+/gi, '')
    // Disallow javascript: and data: pseudo-protocols
    .replace(/href\s*=\s*(['"])\s*(?:javascript|data|vbscript):.*?\1/gi, 'href="#"');

  // Track anchor safety so malformed/unsafe links never leave mismatched tags behind.
  let anchorState: 'safe' | 'unsafe' | null = null;

  return cleaned.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tag, attrs) => {
    const allowed = ['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'a'];
    const lowerTag = tag.toLowerCase();
    if (!allowed.includes(lowerTag)) {
      return '';
    }

    if (lowerTag === 'a') {
      if (match.startsWith('</')) {
        const closing = anchorState === 'unsafe' ? '' : '</a>';
        anchorState = null;
        return closing;
      }

      const hrefMatch = attrs.match(/href\s*=\s*(['"])(.*?)\1/i);
      const href = hrefMatch ? hrefMatch[2] : '#';
      if (/^(https?:\/\/|mailto:|\/)/i.test(href.trim())) {
        anchorState = 'safe';
        return `<a href="${href.trim()}" target="_blank" rel="noopener noreferrer">`;
      }

      anchorState = 'unsafe';
      return '';
    }

    if (lowerTag === 'br') {
      return '<br />';
    }
    return match.startsWith('</') ? `</${lowerTag}>` : `<${lowerTag}>`;
  });
}

export default sanitizeHtml;
