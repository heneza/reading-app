import { describe, it, expect } from 'vitest';
import { sanitizePostHtml, htmlToText } from './sanitize';

describe('sanitizePostHtml', () => {
  it('strips script tags', () => {
    expect(sanitizePostHtml('<p>hi</p><script>alert(1)</script>')).not.toContain('script');
  });
  it('strips img + event handlers (XSS vectors)', () => {
    const out = sanitizePostHtml('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('<img');
  });
  it('keeps allowed formatting tags', () => {
    expect(sanitizePostHtml('<b>bold</b>')).toContain('<b>');
  });
});

describe('htmlToText', () => {
  it('extracts plain text', () => expect(htmlToText('<p>hello world</p>')).toBe('hello world'));
});
