import sanitizeHtml from 'sanitize-html';

/**
 * Safe HTML for rich text (product description, blog, pages, email templates).
 * Allows common formatting; strips script, iframe, event handlers, etc.
 */
const DEFAULT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
    'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'span', 'div',
    'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
    'figure', 'figcaption', 'video', 'audio', 'source',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    video: ['src', 'controls', 'playsinline', 'preload', 'poster', 'width', 'height', 'loop', 'muted', 'autoplay'],
    audio: ['src', 'controls', 'preload'],
    source: ['src', 'type'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
};

/**
 * Sanitize HTML string. Returns null for null/undefined/empty; otherwise sanitized string.
 */
export function sanitizeHtmlContent(html: string | null | undefined): string | null {
  if (html == null) return null;
  const s = String(html).trim();
  if (s === '') return null;
  return sanitizeHtml(s, DEFAULT_OPTIONS);
}

/**
 * Sanitize but keep non-empty original if it was plain text (no tags).
 * Use when field may be either plain text or HTML.
 */
export function sanitizeHtmlContentOrPlain(html: string | null | undefined): string | null {
  if (html == null) return null;
  const s = String(html).trim();
  if (s === '') return null;
  const out = sanitizeHtml(s, DEFAULT_OPTIONS);
  return out === '' ? null : out;
}
