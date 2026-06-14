import { describe, it, expect } from 'vitest';
import { classifySubjects, genreName } from './genres';

describe('classifySubjects', () => {
  it('maps fantasy subjects to the fantasy genre', () => {
    expect(classifySubjects(['Fantasy fiction', 'Magic'])).toContain('fantasy');
  });
  it('falls back to literary-fiction for generic fiction', () => {
    expect(classifySubjects(['Fiction'])).toContain('literary-fiction');
  });
  it('returns nothing for unrelated subjects', () => {
    expect(classifySubjects(['Cooking'])).toEqual([]);
  });
  it('caps the result at 5 genres', () => {
    const out = classifySubjects(['fantasy', 'science fiction', 'horror', 'mystery', 'romance', 'poetry', 'history']);
    expect(out.length).toBeLessThanOrEqual(5);
  });
});

describe('genreName', () => {
  it('returns the display name for a known slug', () => expect(genreName('fantasy')).toBe('Fantasy'));
  it('falls back to the slug when unknown', () => expect(genreName('nope')).toBe('nope'));
});
