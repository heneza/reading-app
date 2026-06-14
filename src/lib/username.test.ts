import { describe, it, expect } from 'vitest';
import { normalizeUsername, validateUsername } from './username';

describe('validateUsername', () => {
  it('accepts a valid username', () => expect(validateUsername('nesha_1')).toBeNull());
  it('rejects too short', () => expect(validateUsername('ab')).toMatch(/3/));
  it('rejects too long', () => expect(validateUsername('a'.repeat(21))).toMatch(/20/));
  it('rejects illegal characters', () => expect(validateUsername('bad name!')).toMatch(/only/i));
});

describe('normalizeUsername', () => {
  it('trims and lowercases', () => expect(normalizeUsername('  NeShA ')).toBe('nesha'));
});
