import Link from 'next/link';
import Image from 'next/image';
import { searchBooks, searchAuthors, coverUrl } from '@/lib/openlibrary';
import { addToShelf } from '@/app/actions/shelf';
import { createClient } from '@/utils/supabase/server';
import SearchForm from './SearchForm';
import PostCard from '@/components/PostCard';

type Filter = 'books' | 'authors' | 'users' | 'posts';

// A centered, light-gray message used for empty / prompt states.
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-16 text-center text-slate-400">{children}</p>
  );
}

// Always render fresh (no caching) so data and login state are current.
export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; filter?: string };
}) {
  const q = (searchParams.q ?? '').trim();
  const filter: Filter = (['books', 'authors', 'users', 'posts'].includes(
    searchParams.filter ?? ''
  )
    ? searchParams.filter
    : 'books') as Filter;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let books: Awaited<ReturnType<typeof searchBooks>> = [];
  let authors: Awaited<ReturnType<typeof searchAuthors>> = [];
  let users: { username: string; display_name: string | null }[] = [];
  let posts: any[] = [];
  const postAuthors = new Map<string, any>();

  if (q) {
    if (filter === 'books') {
      books = await searchBooks(q);
    } else if (filter === 'authors') {
      authors = await searchAuthors(q);
    } else if (filter === 'users') {
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(20);
      users = data ?? [];
    } else {
      const tag = q.toLowerCase().replace(/^#/, '');
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'published')
        .contains('tags', [tag])
        .order('created_at', { ascending: false })
        .limit(30);
      posts = data ?? [];
      const ids = Array.from(new Set(posts.map((x: any) => x.user_id)));
      if (ids.length) {
        const { data: au } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', ids);
        (au ?? []).forEach((a: any) => postAuthors.set(a.id, a));
      }
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Search</h1>

      <SearchForm q={q} filter={filter} />

      {/* No search typed yet */}
      {!q && <Empty>Search for books, authors, users, or post #tags.</Empty>}

      {/* --- BOOKS --- */}
      {q && filter === 'books' && (
        books.length === 0 ? (
          <Empty>Oops! No book found with that name.</Empty>
        ) : (
          <ul className="space-y-3">
            {books.map((b) => {
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
                      <input type="hidden" name="coverId" value={b.coverId ?? ''} />
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
        )
      )}

      {/* --- AUTHORS --- */}
      {q && filter === 'authors' && (
        authors.length === 0 ? (
          <Empty>Oops! No author with this name!</Empty>
        ) : (
          <ul className="space-y-2">
            {authors.map((a) => (
              <li
                key={a.key}
                className="rounded border border-slate-200 bg-white p-3"
              >
                <Link
                  href={`/search?filter=books&q=${encodeURIComponent(a.name)}`}
                  className="font-medium hover:text-brand"
                >
                  {a.name}
                </Link>
                {a.workCount ? (
                  <span className="ml-2 text-sm text-slate-500">
                    {a.workCount} works
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )
      )}

      {/* --- POSTS (by tag) --- */}
      {q && filter === 'posts' && (
        posts.length === 0 ? (
          <Empty>No posts tagged #{q.toLowerCase().replace(/^#/, '')}.</Empty>
        ) : (
          <ul className="space-y-3">
            {posts.map((p: any) => (
              <li key={p.id}>
                <PostCard post={p} author={postAuthors.get(p.user_id)} />
              </li>
            ))}
          </ul>
        )
      )}

      {/* --- USERS --- */}
      {q && filter === 'users' && (
        users.length === 0 ? (
          <Empty>Oops! No user with this name!</Empty>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li
                key={u.username}
                className="rounded border border-slate-200 bg-white p-3"
              >
                <Link
                  href={`/u/${u.username}`}
                  className="font-medium hover:text-brand"
                >
                  {u.display_name ?? u.username}
                </Link>
                <span className="ml-2 text-sm text-slate-500">@{u.username}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
