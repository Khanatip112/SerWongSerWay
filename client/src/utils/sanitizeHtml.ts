/**
 * HTML Sanitizer for Rich Text formatting (XSS Prevention)
 * Strictly allowlists safe markup: <b>, <strong>, <i>, <em>, <u>, <a href="..." target="_blank" rel="noopener noreferrer">, <br>, <p>
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  // In browser DOM environment, use DOMParser
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    const cleanNode = (node: Node): Node | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.cloneNode(true);
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        // Strict formatting tag allowlist
        const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'br', 'p'];

        if (tagName === 'a') {
          const rawHref = el.getAttribute('href') || '';
          // Strictly reject javascript:, data:, vbscript: protocols
          const isSafeHref = /^(https?:\/\/|mailto:|\/)/i.test(rawHref.trim());
          if (!isSafeHref) {
            // Drop the unsafe anchor tag entirely and keep only its child content.
            const fragment = document.createDocumentFragment();
            Array.from(el.childNodes).forEach((child) => {
              const cleaned = cleanNode(child);
              if (cleaned) fragment.appendChild(cleaned);
            });
            return fragment;
          }

          const newA = document.createElement('a');
          newA.setAttribute('href', rawHref.trim());
          newA.setAttribute('target', '_blank');
          newA.setAttribute('rel', 'noopener noreferrer');
          Array.from(el.childNodes).forEach((child) => {
            const cleaned = cleanNode(child);
            if (cleaned) newA.appendChild(cleaned);
          });
          return newA;
        }

        if (allowedTags.includes(tagName)) {
          const newEl = document.createElement(tagName);
          Array.from(el.childNodes).forEach((child) => {
            const cleaned = cleanNode(child);
            if (cleaned) newEl.appendChild(cleaned);
          });
          return newEl;
        }

        // For disallowed tags (e.g. <script>, <style>, <iframe>), discard tag and retain safe children
        if (['script', 'style', 'iframe', 'object', 'embed', 'form'].includes(tagName)) {
          return null;
        }

        const fragment = document.createDocumentFragment();
        Array.from(el.childNodes).forEach((child) => {
          const cleaned = cleanNode(child);
          if (cleaned) fragment.appendChild(cleaned);
        });
        return fragment;
      }

      return null;
    };

    const container = document.createElement('div');
    Array.from(doc.body.childNodes).forEach((child) => {
      const cleaned = cleanNode(child);
      if (cleaned) container.appendChild(cleaned);
    });

    return container.innerHTML;
  }

  // Fallback regex sanitizer (same strict allowlist, with balanced anchors)
  const cleaned = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/href\s*=\s*(['"])\s*(?:javascript|data|vbscript):.*?\1/gi, 'href="#"');

  let anchorState: 'safe' | 'unsafe' | null = null;
  return cleaned.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tag, attrs) => {
    const allowed = ['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'a'];
    const lowered = tag.toLowerCase();
    if (!allowed.includes(lowered)) return '';
    if (lowered === 'a') {
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
    if (lowered === 'br') return '<br />';
    return match.startsWith('</') ? `</${lowered}>` : `<${lowered}>`;
  });
}

export default sanitizeHtml;
