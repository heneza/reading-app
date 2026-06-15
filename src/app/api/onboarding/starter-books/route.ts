import { NextResponse } from 'next/server';
import { GENRE_SUBJECTS } from '@/lib/genre-subjects';
import { fetchSubjectWorks } from '@/lib/openlibrary';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
};

function cleanGenres(raw: string | null) {
  return (raw ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter((g) => GENRE_SUBJECTS[g])
    .slice(0, 5);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const genres = cleanGenres(url.searchParams.get('genres'));

  if (genres.length === 0) return NextResponse.json({ items: [] }, { headers: CACHE_HEADERS });

  const results = await Promise.all(
    genres.map((genre) => fetchSubjectWorks(GENRE_SUBJECTS[genre], 8))
  );
  const seen = new Set<string>();
  const items = results
    .flat()
    .filter((book) => {
      if (!book.key || seen.has(book.key)) return false;
      seen.add(book.key);
      return true;
    })
    .slice(0, 12);

  return NextResponse.json({ items }, { headers: CACHE_HEADERS });
}
