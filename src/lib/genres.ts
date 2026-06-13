// =====================================================================
// Genre taxonomy + a simple classifier that maps Open Library "subjects"
// onto our genres. Pure data + functions only (safe to import anywhere,
// including client components) — no database or server imports here.
// Keep the slugs in sync with supabase/09_genres.sql.
// =====================================================================

export interface Genre {
  slug: string;
  name: string;
}

export const GENRES: Genre[] = [
  { slug: 'literary-fiction', name: 'Literary Fiction' },
  { slug: 'classics', name: 'Classics' },
  { slug: 'contemporary', name: 'Contemporary Fiction' },
  { slug: 'historical-fiction', name: 'Historical Fiction' },
  { slug: 'mystery-crime', name: 'Mystery & Crime' },
  { slug: 'thriller', name: 'Thriller & Suspense' },
  { slug: 'horror', name: 'Horror' },
  { slug: 'science-fiction', name: 'Science Fiction' },
  { slug: 'fantasy', name: 'Fantasy' },
  { slug: 'romance', name: 'Romance' },
  { slug: 'young-adult', name: 'Young Adult' },
  { slug: 'childrens', name: "Children's" },
  { slug: 'poetry', name: 'Poetry' },
  { slug: 'drama', name: 'Drama & Plays' },
  { slug: 'short-stories', name: 'Short Stories' },
  { slug: 'graphic-novels', name: 'Comics & Graphic Novels' },
  { slug: 'letters', name: 'Letters & Diaries' },
  { slug: 'essays', name: 'Essays' },
  { slug: 'biography-memoir', name: 'Biography & Memoir' },
  { slug: 'history', name: 'History' },
  { slug: 'philosophy', name: 'Philosophy' },
  { slug: 'psychology', name: 'Psychology' },
  { slug: 'self-help', name: 'Self-Help' },
  { slug: 'science-nature', name: 'Science & Nature' },
  { slug: 'society-politics', name: 'Society & Politics' },
  { slug: 'religion-spirituality', name: 'Religion & Spirituality' },
  { slug: 'travel', name: 'Travel' },
  { slug: 'art-design', name: 'Art & Design' },
  { slug: 'business-economics', name: 'Business & Economics' },
];

const NAME_BY_SLUG = new Map(GENRES.map((g) => [g.slug, g.name]));

export function genreName(slug: string): string {
  return NAME_BY_SLUG.get(slug) ?? slug;
}

// Ordered most-specific -> most-general. Each rule: if ANY subject contains
// one of the keywords, the book gets that genre. A book can match several.
const RULES: { slug: string; keywords: string[] }[] = [
  { slug: 'historical-fiction', keywords: ['historical fiction'] },
  { slug: 'science-fiction', keywords: ['science fiction', 'sci-fi', 'dystopia', 'space opera'] },
  { slug: 'fantasy', keywords: ['fantasy', 'magic', 'dragons', 'mythology', 'fairy tales'] },
  { slug: 'horror', keywords: ['horror', 'ghost', 'vampire', 'haunt'] },
  { slug: 'mystery-crime', keywords: ['mystery', 'detective', 'crime', 'murder', 'noir'] },
  { slug: 'thriller', keywords: ['thriller', 'suspense', 'espionage', 'spy'] },
  { slug: 'romance', keywords: ['romance', 'love stories', 'romantic'] },
  { slug: 'young-adult', keywords: ['young adult', 'ya fiction', 'teen'] },
  { slug: 'childrens', keywords: ['juvenile', 'children', 'picture book', 'kids'] },
  { slug: 'poetry', keywords: ['poetry', 'poems', 'verse'] },
  { slug: 'drama', keywords: ['drama', 'plays', 'theater', 'theatre', 'tragedy', 'comedy (drama)'] },
  { slug: 'short-stories', keywords: ['short stories', 'short story'] },
  { slug: 'graphic-novels', keywords: ['comic', 'graphic novel', 'manga', 'cartoons'] },
  { slug: 'letters', keywords: ['correspondence', 'letters', 'diaries', 'diary'] },
  { slug: 'essays', keywords: ['essays', 'essay'] },
  { slug: 'biography-memoir', keywords: ['biography', 'autobiography', 'memoir'] },
  { slug: 'history', keywords: ['history', 'historical', 'war', 'ancient'] },
  { slug: 'philosophy', keywords: ['philosophy', 'ethics', 'metaphysics', 'existential'] },
  { slug: 'psychology', keywords: ['psychology', 'psychoanalysis', 'mental health'] },
  { slug: 'self-help', keywords: ['self-help', 'self help', 'personal development', 'productivity'] },
  { slug: 'science-nature', keywords: ['science', 'nature', 'biology', 'physics', 'mathematics', 'astronomy', 'evolution'] },
  { slug: 'society-politics', keywords: ['politic', 'social science', 'society', 'sociology', 'feminism', 'economic policy'] },
  { slug: 'religion-spirituality', keywords: ['religion', 'spiritual', 'theology', 'bible', 'buddhis', 'christian', 'islam'] },
  { slug: 'travel', keywords: ['travel', 'voyages', 'description and travel'] },
  { slug: 'art-design', keywords: ['art', 'painting', 'photography', 'design', 'architecture', 'music'] },
  { slug: 'business-economics', keywords: ['business', 'economics', 'management', 'finance', 'entrepreneur', 'marketing'] },
  { slug: 'classics', keywords: ['classic', 'literature', 'literary criticism'] },
];

// Map a list of Open Library subjects to a de-duplicated list of genre slugs.
export function classifySubjects(subjects: string[]): string[] {
  const hay = subjects.map((s) => s.toLowerCase());
  const found: string[] = [];

  for (const rule of RULES) {
    if (rule.keywords.some((k) => hay.some((s) => s.includes(k)))) {
      found.push(rule.slug);
    }
  }

  // Fallback: anything tagged generically as fiction becomes Literary Fiction.
  if (found.length === 0 && hay.some((s) => s.includes('fiction'))) {
    found.push('literary-fiction');
  }

  // Keep it tidy: order by our canonical list, cap at 5.
  const order = new Map(GENRES.map((g, i) => [g.slug, i]));
  return Array.from(new Set(found))
    .sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
    .slice(0, 5);
}
