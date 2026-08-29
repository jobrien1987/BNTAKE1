import sanitizeHtml from 'sanitize-html';

/**
 * Article and campaign bodies are stored as HTML and sanitised on the way out.
 * Nothing user-authored is ever passed to dangerouslySetInnerHTML unsanitised.
 */
const options: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2', 'h3', 'h4', 'p', 'blockquote', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i',
    'a', 'br', 'hr', 'figure', 'figcaption', 'img', 'iframe', 'code', 'pre', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
    span: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer nofollow' },
    }),
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
  },
};

export function sanitizeRichText(html: string) {
  return sanitizeHtml(html ?? '', options);
}

/** Plain-text extraction used for excerpts, SEO descriptions and search. */
export function toPlainText(html: string, maxLength = 400) {
  const text = sanitizeHtml(html ?? '', { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

export function estimateReadMinutes(html: string) {
  const words = toPlainText(html, 100000).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}
