import Image from 'next/image';
import { searchBooks, coverUrl } from '@/lib/openlibrary';
import { addToShelf } from '@/app/actions/shelf';
import { createClient } from '@/utils/supabase/server';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q ?? '';
  const results = await searchBooks(q);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Search books</h1>

      <form className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Title, author, keyword…"
          className="flex-1 rounded border border-slate-300 px-3 py-2"
        />
        <button className="rounded bg-brand px-4 py-2 font-medium text-white hover:opacity-90">
          Search
        </button>
      </form>

      {q && results.length === 0 && (
        <p className="text-slate-500">No results for “{q}”.</p>
      )}

      <ul className="space-y-3">
        {results.map((b) => {
          const src = coverUrl(b.coverId, 'S');
          return (
            <li
              key={b.key}
              className="flex items-center gap-4 rounded border border-slate-200 bg-white p-3"
            >
              <div className="h-[72px] w-[48px] flex-shrink-0 overflow-hidden rounded bg-slate-100">
                {src && (
                  <Image
                    src={src}
                    alt={b.title}
                    width={48}
                    height={72}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.title}</p>
                <p className="truncate text-sm text-slate-500">
                  {b.author ?? 'Unknown author'}
                  {b.year ? ` · ${b.year}` : ''}
                </p>
              </div>

              {user ? (
                <form action={addToShelf} className="flex items-center gap-2">
                  <input type="hidden" name="olKey" value={b.key} />
                  <input type="hidden" name="title" value={b.title} />
                  <input type="hidden" name="author" value={b.author ?? ''} />
                  <input
                    type="hidden"
                    name="coverId"
                    value={b.coverId ?? ''}
                  />
                  <select
                    name="status"
                    defaultValue="read"
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="want_to_read">Want to read</option>
                    <option value="reading">Reading</option>
                    <option value="read">Read</option>
                    <option value="dnf">DNF</option>
                  </select>
                  <button className="rounded bg-brand px-3 py-1 text-sm font-medium text-white hover:opacity-90">
                    Add
                  </button>
                </form>
              ) : (
                <span className="text-xs text-slate-400">Log in to add</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
