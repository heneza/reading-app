import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { GENRES } from '@/lib/genres';
import ListCard from '@/components/ListCard';
import { createList, seedGenreLists } from '@/app/actions/lists';

export const dynamic = 'force-dynamic';

const MIN_VISIBLE_GENRE_LIST_BOOKS = 6;

export default async function ListsPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    isAdmin = !!me?.is_admin;
  }

  const { data: allLists } = await supabase
    .from('lists')
    .select('id, owner_id, title, description, genre, is_system, created_at')
    .order('created_at', { ascending: false });
  const lists = allLists ?? [];
  const ids = lists.map((l: any) => l.id);

  const coversByList = new Map<string, (number | null)[]>();
  const countByList = new Map<string, number>();
  const likeByList = new Map<string, number>();
  if (ids.length) {
    const { data: items } = await supabase
      .from('list_items')
      .select('list_id, position, books ( cover_id )')
      .in('list_id', ids)
      .order('position', { ascending: true });
    (items ?? []).forEach((it: any) => {
      countByList.set(it.list_id, (countByList.get(it.list_id) ?? 0) + 1);
      const arr = coversByList.get(it.list_id) ?? [];
      if (arr.length < 3) {
        arr.push(it.books?.cover_id ?? null);
        coversByList.set(it.list_id, arr);
      }
    });
    const { data: likes } = await supabase.from('list_likes').select('list_id').in('list_id', ids);
    (likes ?? []).forEach((l: any) => likeByList.set(l.list_id, (likeByList.get(l.list_id) ?? 0) + 1));
  }

  const allGenreLists = lists.filter((l: any) => l.is_system);
  const genreLists = allGenreLists.filter(
    (l: any) => (countByList.get(l.id) ?? 0) >= MIN_VISIBLE_GENRE_LIST_BOOKS
  );
  const communityLists = lists.filter((l: any) => !l.is_system);

  const ownerName = new Map<string, string>();
  const ownerIds = Array.from(new Set(communityLists.map((l: any) => l.owner_id).filter(Boolean)));
  if (ownerIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ownerIds);
    (profs ?? []).forEach((p: any) => ownerName.set(p.id, p.username));
  }

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Lists</h1>
      </header>

      {/* Create a list */}
      {user && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">New list</h2>
          {searchParams?.error && (
            <p className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{searchParams.error}</p>
          )}
          <form action={createList} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-1 flex-col text-xs text-slate-500">
              Title
              <input name="title" maxLength={120} placeholder="e.g. Books that wrecked me" className="mt-1 rounded border border-slate-300 px-3 py-1.5 text-sm" />
            </label>
            <label className="flex flex-[2] flex-col text-xs text-slate-500">
              Description (optional)
              <input name="description" maxLength={500} placeholder="A short blurb…" className="mt-1 rounded border border-slate-300 px-3 py-1.5 text-sm" />
            </label>
            <button className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90">Create</button>
          </form>
          <p className="mt-2 text-xs text-stone-400">Add books to your list from any book’s page.</p>
        </section>
      )}

      {/* Community lists */}
      {communityLists.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Community lists</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {communityLists.map((l: any) => (
              <ListCard
                key={l.id}
                id={l.id}
                title={l.title}
                subtitle={l.owner_id ? `@${ownerName.get(l.owner_id) ?? '…'}` : undefined}
                count={countByList.get(l.id) ?? 0}
                likeCount={likeByList.get(l.id) ?? 0}
                covers={coversByList.get(l.id) ?? []}
              />
            ))}
          </div>
        </section>
      )}

      {/* Genre lists */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">By genre</h2>
        {genreLists.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
            Genre lists are still filling up{isAdmin ? ' — use the panel below to seed or refresh them.' : '.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {genreLists.map((l: any) => (
              <ListCard
                key={l.id}
                id={l.id}
                title={l.title}
                count={countByList.get(l.id) ?? 0}
                likeCount={likeByList.get(l.id) ?? 0}
                covers={coversByList.get(l.id) ?? []}
              />
            ))}
          </div>
        )}
      </section>

      {/* Admin: seed genre lists */}
      {isAdmin && (
        <section className="rounded-xl border border-dashed border-stone-300 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Founder · seed genre lists</h2>
          <p className="mb-3 text-xs text-stone-500">
            Pulls each genre’s most popular books from Open Library. Re-running refreshes a list. If “seed all” times out, seed genres individually.
          </p>
          <form action={seedGenreLists} className="mb-3">
            <button className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">Seed / refresh all</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <form key={g.slug} action={seedGenreLists}>
                <input type="hidden" name="genre" value={g.slug} />
                <button className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 hover:border-brand hover:text-brand">{g.name}</button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
