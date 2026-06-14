// Thin client for the free Open Library APIs.

export interface OLBook {
  key: string;
  title: string;
  author?: string;
  year?: number;
  coverId?: number;
}

export interface OLAuthor {
  key: string;
  name: string;
  workCount?: number;
}

// Search books by title / author / keyword.
export async function searchBooks(query: string): Promise<OLBook[]> {
  const q = query.trim();
  if (!q) return [];

  const url =
    'https://openlibrary.org/search.json' +
    `?q=${encodeURIComponent(q)}` +
    '&limit=20' +
    '&fields=key,title,author_name,first_publish_year,cover_i';

  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(14000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs ?? []).map((d: any): OLBook => ({
      key: d.key,
      title: d.title,
      author: d.author_name?.[0],
      year: d.first_publish_year,
      coverId: d.cover_i,
    }));
  } catch {
    return [];
  }
}

// Search authors by name.
export async function searchAuthors(query: string): Promise<OLAuthor[]> {
  const q = query.trim();
  if (!q) return [];

  const url =
    'https://openlibrary.org/search/authors.json' +
    `?q=${encodeURIComponent(q)}&limit=20`;

  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(14000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs ?? []).map((d: any): OLAuthor => ({
      key: d.key,
      name: d.name,
      workCount: d.work_count,
    }));
  } catch {
    return [];
  }
}

export function coverUrl(coverId?: number | null, size: 'S' | 'M' | 'L' = 'M') {
  return coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
    : null;
}

// Fetch the list of subject strings for a work (used to classify genres).
// `workKey` looks like "/works/OL12345W".
export async function fetchSubjects(workKey: string): Promise<string[]> {
  const key = workKey.startsWith('/') ? workKey : `/${workKey}`;
  if (!/^\/works\/OL\d+W$/.test(key)) return []; // guard against SSRF via crafted keys
  try {
    const res = await fetch(`https://openlibrary.org${key}.json`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    const subjects = data.subjects;
    return Array.isArray(subjects) ? subjects.map((x: any) => String(x)) : [];
  } catch {
    return [];
  }
}

// Look up a book edition by ISBN -> its work key, title, and cover id.
export async function lookupByIsbn(
  isbn: string
): Promise<{ olKey: string; title: string; coverId?: number } | null> {
  const clean = (isbn || '').replace(/[^0-9Xx]/g, '');
  if (!clean) return null;
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${clean}.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const olKey = data?.works?.[0]?.key as string | undefined;
    if (!olKey) return null;
    const coverId = Array.isArray(data.covers) ? data.covers[0] : undefined;
    return { olKey, title: data.title ?? '', coverId };
  } catch {
    return null;
  }
}

// Fetch a work's description (string or { value }).
export async function fetchDescription(workKey: string): Promise<string> {
  if (!workKey) return '';
  const key = workKey.startsWith('/') ? workKey : `/${workKey}`;
  if (!/^\/works\/OL\d+W$/.test(key)) return ''; // guard against SSRF via crafted keys
  try {
    const res = await fetch(`https://openlibrary.org${key}.json`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return '';
    const d = await res.json();
    const desc = d?.description;
    if (!desc) return '';
    return typeof desc === 'string' ? desc : String(desc.value ?? '');
  } catch {
    return '';
  }
}

// Fetch a subject's most-popular works (Open Library ranks them roughly by
// popularity). Used to seed the curated genre lists.
export async function fetchSubjectWorks(
  subject: string,
  limit = 24
): Promise<OLBook[]> {
  const slug = subject.trim().toLowerCase().replace(/\s+/g, '_');
  try {
    const res = await fetch(
      `https://openlibrary.org/subjects/${slug}.json?limit=${limit}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.works ?? []).map((w: any): OLBook => ({
      key: w.key, // "/works/OL...W"
      title: w.title,
      author: w.authors?.[0]?.name,
      year: w.first_publish_year,
      coverId: w.cover_id,
    }));
  } catch {
    return [];
  }
}
