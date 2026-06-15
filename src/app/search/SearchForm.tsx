'use client';

import { useRouter } from 'next/navigation';
import SearchSuggestBox from '@/components/SearchSuggestBox';

export default function SearchForm({
  q,
  filter,
}: {
  q: string;
  filter: string;
}) {
  const router = useRouter();

  // Build the /search URL and navigate to it (client-side).
  function go(newQ: string, newFilter: string) {
    const params = new URLSearchParams();
    params.set('filter', newFilter);
    if (newQ) params.set('q', newQ);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row">
      <select
        name="filter"
        defaultValue={filter}
        onChange={(e) => {
          go(q, e.currentTarget.value);
        }}
        className="w-full sm:w-auto sm:min-w-[7rem]"
      >
        <option value="books">Books</option>
        <option value="authors">Authors</option>
        <option value="users">Users</option>
        <option value="posts">Posts</option>
      </select>
      <SearchSuggestBox
        key={filter}
        defaultValue={q}
        filter={filter}
        placeholder="Search…"
        className="flex min-w-0 flex-1 gap-2"
        inputClassName="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2"
        showButton
      />
    </div>
  );
}
