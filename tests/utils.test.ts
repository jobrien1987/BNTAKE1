import { describe, it, expect } from 'vitest';
import { safeRedirectPath, truncate, formatDuration, initialsOf } from '@/lib/utils';
import { slugify as slugifyFromSlugLib, uniqueSlug } from '@/lib/slug';

describe('safeRedirectPath', () => {
  // This is an open-redirect guard: anything that could send a user to another
  // origin after sign-in must be rejected.
  it('accepts ordinary internal paths', () => {
    expect(safeRedirectPath('/account/library')).toBe('/account/library');
    expect(safeRedirectPath('/shop?category=vinyl')).toBe('/shop?category=vinyl');
  });

  it('rejects absolute URLs to other origins', () => {
    expect(safeRedirectPath('https://evil.example.com')).toBe('/');
    expect(safeRedirectPath('http://evil.example.com/path')).toBe('/');
  });

  it('rejects protocol-relative URLs', () => {
    expect(safeRedirectPath('//evil.example.com')).toBe('/');
  });

  it('rejects non-http schemes', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/');
  });

  it('falls back for empty or missing input', () => {
    expect(safeRedirectPath(null)).toBe('/');
    expect(safeRedirectPath(undefined)).toBe('/');
    expect(safeRedirectPath('')).toBe('/');
  });

  it('honours a custom fallback', () => {
    expect(safeRedirectPath(null, '/account')).toBe('/account');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyFromSlugLib('Lowlight Hours')).toBe('lowlight-hours');
  });

  it('strips punctuation and collapses separators', () => {
    const result = slugifyFromSlugLib('  Hello,   World!!  ');
    expect(result).toBe('hello-world');
  });

  it('produces URL-safe output for accented input', () => {
    expect(slugifyFromSlugLib('Café Déjà Vu')).toMatch(/^[a-z0-9-]*$/);
  });
});

describe('uniqueSlug', () => {
  it('returns the base when it is free', () => {
    expect(uniqueSlug('paper-crown', [])).toBe('paper-crown');
  });

  it('suffixes when the base is taken', () => {
    const result = uniqueSlug('paper-crown', ['paper-crown']);
    expect(result).not.toBe('paper-crown');
    expect(result.startsWith('paper-crown')).toBe(true);
  });
});

describe('formatDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(194)).toBe('3:14');
    expect(formatDuration(60)).toBe('1:00');
  });

  it('pads seconds below ten', () => {
    expect(formatDuration(65)).toBe('1:05');
  });
});

describe('truncate', () => {
  it('leaves short strings alone', () => {
    expect(truncate('short', 20)).toBe('short');
  });

  it('shortens long strings', () => {
    const result = truncate('a'.repeat(100), 20);
    expect(result.length).toBeLessThanOrEqual(21);
  });
});

describe('initialsOf', () => {
  it('derives initials from a name', () => {
    expect(initialsOf('Vega Rain')).toBe('VR');
  });

  it('handles a single word', () => {
    expect(initialsOf('Boosie').length).toBeGreaterThan(0);
  });
});
