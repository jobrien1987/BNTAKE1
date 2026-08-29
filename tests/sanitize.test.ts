import { describe, it, expect } from 'vitest';
import { sanitizeRichText, toPlainText, estimateReadMinutes } from '@/server/services/sanitize';

describe('sanitizeRichText', () => {
  // Article and campaign bodies are author-supplied HTML rendered with
  // dangerouslySetInnerHTML, so this is the boundary that has to hold.
  it('strips script tags', () => {
    const result = sanitizeRichText('<p>Fine</p><script>alert(1)</script>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(1)');
    expect(result).toContain('Fine');
  });

  it('strips inline event handlers', () => {
    const result = sanitizeRichText('<p onclick="steal()">Text</p>');
    expect(result).not.toContain('onclick');
    expect(result).toContain('Text');
  });

  it('strips javascript: URLs from links', () => {
    const result = sanitizeRichText('<a href="javascript:alert(1)">Click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('strips iframes', () => {
    const result = sanitizeRichText('<iframe src="https://evil.example.com"></iframe>');
    expect(result).not.toContain('<iframe');
  });

  it('keeps ordinary formatting intact', () => {
    const result = sanitizeRichText(
      '<h2>Heading</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>Item</li></ul>',
    );
    expect(result).toContain('<h2>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<li>');
  });

  it('keeps safe external links', () => {
    const result = sanitizeRichText('<a href="https://example.com">Link</a>');
    expect(result).toContain('href="https://example.com"');
  });
});

describe('toPlainText', () => {
  it('removes markup', () => {
    expect(toPlainText('<p>Hello <strong>world</strong></p>')).toContain('Hello');
    expect(toPlainText('<p>Hello</p>')).not.toContain('<p>');
  });

  it('respects the length cap', () => {
    const result = toPlainText(`<p>${'a'.repeat(1000)}</p>`, 50);
    expect(result.length).toBeLessThanOrEqual(51);
  });
});

describe('estimateReadMinutes', () => {
  it('returns at least one minute for short content', () => {
    expect(estimateReadMinutes('<p>Short.</p>')).toBeGreaterThanOrEqual(1);
  });

  it('scales with length', () => {
    const long = `<p>${'word '.repeat(2000)}</p>`;
    expect(estimateReadMinutes(long)).toBeGreaterThan(1);
  });
});
