import { describe, it, expect } from 'vitest';
import { timeAgo, formatDate } from './time';

describe('timeAgo', () => {
  it('shows "now" for the present', () => expect(timeAgo(new Date().toISOString())).toBe('now'));
  it('shows minutes', () => expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5m ago'));
});

describe('formatDate', () => {
  it('formats a YYYY-MM-DD date', () => expect(formatDate('2026-06-14')).toMatch(/2026/));
  it('passes through an invalid value', () => expect(formatDate('bad')).toBe('bad'));
});
