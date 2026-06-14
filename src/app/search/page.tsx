import { Suspense } from 'react';
import SearchForm from './SearchForm';
import SearchResults from './SearchResults';

type Filter = 'books' | 'authors' | 'users' | 'posts';

export const dynamic = 'force-dynamic';

function ResultsSkeleton() {
  return (
    <ul className="mt-2 animate-pulse space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="h-[88px] w-full rounded border border-slate-200 bg-stone-100" />
      ))}
    </ul>
  );
}

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; filter?: string };
}) {
  const q = (searchParams.q ?? '').trim();
  const filter: Filter = (['books', 'authors', 'users', 'posts'].includes(searchParams.filter ?? '')
    ? searchParams.filter
    : 'books') as Filter;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Search</h1>
      <SearchForm q={q} filter={filter} />

      {!q ? (
        <p className="mt-16 text-center text-slate-400">Search for books, authors, users, or post #tags.</p>
      ) : (
        <Suspense key={`${filter}:${q}`} fallback={<ResultsSkeleton />}>
          <SearchResults q={q} filter={filter} />
        </Suspense>
      )}
    </div>
  );
}
