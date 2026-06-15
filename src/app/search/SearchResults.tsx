import Link from 'next/link';
import Image from 'next/image';
import { searchBooks, searchAuthors, coverUrl } from '@/lib/openlibrary';
import { addToShelf } from '@/app/actions/shelf';
import { createClient } from '@/utils/supabase/server';
import PostCard from '@/components/PostCard';
import PendingButton from '@/components/PendingButton';
import { loadPostCardInteractions } from '@/lib/post-interactions';

type Filter = 'books' | 'authors' | 'users' | 'posts';

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-16 text-center text-slate-400">{children}</p>;
}

// Async results — rendered inside <Suspense> so the search form shows instantly
// while Open Library (books/authors) responds.
export default async function SearchResults({ q, filter }: { q: string; filter: Filter }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (filter === 'books') {
    const books = await searchBooks(q);
    if (books.length === 0) return <Empty>Oops! No book found with that name.</Empty>;
    return (
      <ul className="space-y-3">
        {books.map((b) => {
          const src = coverUrl(b.coverId, 'S');
          const workId = b.key.replace(/^\/works\//, '');
          const detailHref =
            `/book/open-library/${encodeURIComponent(workId)}` +
            `?title=${encodeURIComponent(b.title)}` +
            `&author=${encodeURIComponent(b.author ?? '')}` +
            `&coverId=${encodeURIComponent(String(b.coverId ?? ''))}`;
          return (
            <li key={b.key} className="flex items-center gap-4 rounded border border-slate-200 bg-white p-3">
              <Link href={detailHref} className="flex min-w-0 flex-1 items-center gap-4 rounded transition hover:text-brand">
                <div className="h-[72px] w-[48px] flex-shrink-0 overflow-hidden rounded bg-slate-100">
                  {src && <Image src={src} alt={b.title} width={48} height={72} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.title}</p>
                  <p className="truncate text-sm text-slate-500">{b.author ?? 'Unknown author'}{b.year ? ` · ${b.year}` : ''}</p>
                  <p className="mt-1 text-xs font-medium text-brand">View details</p>
                </div>
              </Link>
              {user ? (
                <form action={addToShelf} className="flex items-center gap-2">
                  <input type="hidden" name="olKey" value={b.key} />
                  <input type="hidden" name="title" value={b.title} />
                  <input type="hidden" name="author" value={b.author ?? ''} />
                  <input type="hidden" name="coverId" value={b.coverId ?? ''} />
                  <select name="status" defaultValue="read" className="rounded border border-slate-300 px-2 py-1 text-sm">
                    <option value="want_to_read">Want to read</option>
                    <option value="reading">Reading</option>
                    <option value="read">Read</option>
                    <option value="dnf">DNF</option>
                  </select>
                  <PendingButton pendingLabel="Adding..." className="rounded bg-brand px-3 py-1 text-sm font-medium text-white hover:opacity-90">Add</PendingButton>
                </form>
              ) : (
                <Link href={detailHref} className="rounded border border-stone-300 px-3 py-1 text-sm font-medium text-stone-700 hover:border-brand hover:text-brand">
                  Open
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  if (filter === 'authors') {
    const authors = await searchAuthors(q);
    if (authors.length === 0) return <Empty>Oops! No author with this name!</Empty>;
    return (
      <ul className="space-y-2">
        {authors.map((a) => (
          <li key={a.key} className="rounded border border-slate-200 bg-white p-3">
            <Link href={`/search?filter=books&q=${encodeURIComponent(a.name)}`} className="font-medium hover:text-brand">{a.name}</Link>
            {a.workCount ? <span className="ml-2 text-sm text-slate-500">{a.workCount} works</span> : null}
          </li>
        ))}
      </ul>
    );
  }

  if (filter === 'users') {
    const { data } = await supabase
      .from('profiles').select('username, display_name')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(20);
    const users = data ?? [];
    if (users.length === 0) return <Empty>Oops! No user with this name!</Empty>;
    return (
      <ul className="space-y-2">
        {users.map((u: any) => (
          <li key={u.username} className="rounded border border-slate-200 bg-white p-3">
            <Link href={`/u/${u.username}`} className="font-medium hover:text-brand">{u.display_name ?? u.username}</Link>
            <span className="ml-2 text-sm text-slate-500">@{u.username}</span>
          </li>
        ))}
      </ul>
    );
  }

  // posts (by tag or keyword)
  const tag = q.toLowerCase().replace(/^#/, '');
  const [{ data: byTag }, { data: byText }] = await Promise.all([
    supabase.from('posts').select('*').eq('status', 'published').contains('tags', [tag]).limit(30),
    supabase.from('posts').select('*').eq('status', 'published').ilike('body_text', `%${q}%`).limit(30),
  ]);
  const seen = new Map<string, any>();
  [...(byTag ?? []), ...(byText ?? [])].forEach((x: any) => seen.set(x.id, x));
  const posts = Array.from(seen.values()).sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));
  if (posts.length === 0) return <Empty>No posts tagged #{tag}.</Empty>;

  const ids = Array.from(new Set(posts.map((x: any) => x.user_id)));
  const postAuthors = new Map<string, any>();
  const [authorsRes, interactions] = await Promise.all([
    ids.length
      ? supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', ids)
      : Promise.resolve({ data: [] as any[] }),
    loadPostCardInteractions(supabase, posts),
  ]);
  (authorsRes.data ?? []).forEach((a: any) => postAuthors.set(a.id, a));
  return (
    <ul className="space-y-3">
      {posts.map((p: any) => (
        <li key={p.id}>
          <PostCard
            post={p}
            author={postAuthors.get(p.user_id)}
            viewerId={user?.id ?? null}
            interactions={interactions.get(p.id)}
          />
        </li>
      ))}
    </ul>
  );
}
