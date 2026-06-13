'use client';

import { useRouter } from 'next/navigation';

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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        go(String(fd.get('q') ?? ''), String(fd.get('filter') ?? 'books'));
      }}
      className="mb-6 flex gap-2"
    >
      <select
        name="filter"
        defaultValue={filter}
        onChange={(e) => {
          // Re-run the search immediately with the new filter.
          const form = e.currentTarget.form!;
          const fd = new FormData(form);
          go(String(fd.get('q') ?? ''), e.currentTarget.value);
        }}
        className="rounded border border-slate-300 px-2 py-2 text-sm"
      >
        <option value="books">Books</option>
        <option value="authors">Authors</option>
        <option value="users">Users</option>
      </select>
      <input
        name="q"
        defaultValue={q}
        placeholder="Search…"
        className="flex-1 rounded border border-slate-300 px-3 py-2"
      />
      <button className="rounded bg-brand px-4 py-2 font-medium text-white hover:opacity-90">
        Search
      </button>
    </form>
  );
}
