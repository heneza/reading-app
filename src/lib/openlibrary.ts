// Thin client for the free Open Library search API.
// Docs: https://openlibrary.org/dev/docs/api/search

export interface OLBook {
  key: string;        // e.g. "/works/OL45883W"
  title: string;
  author?: string;
  year?: number;
  coverId?: number;
}

export async function searchBooks(query: string): Promise<OLBook[]> {
  const q = query.trim();
  if (!q) return [];

  const url =
    'https://openlibrary.org/search.json' +
    `?q=${encodeURIComponent(q)}` +
    '&limit=20' +
    '&fields=key,title,author_name,first_publish_year,cover_i';

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.docs ?? []).map((d: any): OLBook => ({
    key: d.key,
    title: d.title,
    author: d.author_name?.[0],
    year: d.first_publish_year,
    coverId: d.cover_i,
  }));
}

export function coverUrl(coverId?: number | null, size: 'S' | 'M' | 'L' = 'M') {
  return coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
    : null;
}
