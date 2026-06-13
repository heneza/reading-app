import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/time';

export const dynamic = 'force-dynamic';

const VERB: Record<string, string> = {
  reading: 'is reading',
  want_to_read: 'wants to read',
  read: 'read',
  dnf: 'gave up on',
};

type CoverItem = {
  bookId: string;
  title?: string | null;
  author?: string | null;
  coverId?: number | null;
};

function CoverGrid({ items }: { items: CoverItem[] }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {items.map((it) => {
        const src = coverUrl(it.coverId, 'M');
        return (
          <li key={it.bookId}>
            <Link href={`/book/${it.bookId}`} className="group flex flex-col">
              <div className="aspect-[2/3] w-full overflow-hidden rounded bg-slate-100 group-hover:opacity-90">
                {src && (
                  <Image
                    src={src}
                    alt={it.title ?? ''}
                    width={200}
                    height={300}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <p className="mt-1 truncate text-xs font-medium">{it.title}</p>
              <p className="truncate text-[11px] text-stone-500">{it.author}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default async function ExplorePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Trending: most-shelved books (computed for everyone) ------------
  const { data: recentEntries } = await supabase
    .from('reading_entries')
    .select('book_id, books ( title, author, cover_id )')
    .order('updated_at', { ascending: false })
    .limit(300);

  const tally = new Map<string, { count: number; item: CoverItem }>();
  for (const e of recentEntries ?? []) {
    const anyE = e as any;
    if (!anyE.book_id || !anyE.books) continue;
    const cur =
      tally.get(anyE.book_id) ?? {
        count: 0,
        item: {
          bookId: anyE.book_id,
          title: anyE.books.title,
          author: anyE.books.author,
          coverId: anyE.books.cover_id,
        },
      };
    cur.count += 1;
    tally.set(anyE.book_id, cur);
  }
  const trending = Array.from(tally.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((t) => t.item);

  // --- Logged-out: hero + trending ------------------------------------
  if (!user) {
    return (
      <div className="space-y-10">
        <div className="rounded-xl bg-brand-soft px-6 py-10 text-center">
          <h1 className="mb-2 text-3xl font-bold text-brand">A home for readers.</h1>
          <p className="mx-auto mb-5 max-w-md text-stone-600">
            Track what you read, follow friends, and discover your next book.
          </p>
          <Link
            href="/login"
            className="inline-block rounded bg-brand px-5 py-2 font-medium text-white transition hover:bg-brand-dark"
          >
            Get started
          </Link>
        </div>

        {trending.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Trending now</h2>
            <CoverGrid items={trending} />
          </section>
        )}
      </div>
    );
  }

  // --- Logged-in feed -------------------------------------------------
  const { data: me } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user.id)
    .maybeSingle();

  // Who I follow
  const { data: followingRows } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id);
  const followingIds = (followingRows ?? []).map((r: any) => r.followee_id);

  // Activity from people I follow: recent shelf changes + reviews, merged.
  type Activity = {
    at: string;
    userId: string;
    kind: 'shelf' | 'review';
    status?: string;
    rating?: number | null;
    body?: string;
    bookId: string;
    book: any;
  };
  let activity: Activity[] = [];
  const nameById = new Map<string, string>();
  const avatarById = new Map<string, string | null>();

  if (followingIds.length) {
    const [{ data: shelfRows }, { data: reviewRows }] = await Promise.all([
      supabase
        .from('reading_entries')
        .select('user_id, status, rating, updated_at, book_id, books ( title, author, cover_id )')
        .in('user_id', followingIds)
        .order('updated_at', { ascending: false })
        .limit(20),
      supabase
        .from('reviews')
        .select('user_id, body, created_at, book_id, books ( title, author, cover_id )')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    activity = [
      ...(shelfRows ?? []).map((e: any) => ({
        at: e.updated_at,
        userId: e.user_id,
        kind: 'shelf' as const,
        status: e.status,
        rating: e.rating,
        bookId: e.book_id,
        book: e.books,
      })),
      ...(reviewRows ?? []).map((r: any) => ({
        at: r.created_at,
        userId: r.user_id,
        kind: 'review' as const,
        body: r.body,
        bookId: r.book_id,
        book: r.books,
      })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 15);

    const ids = Array.from(new Set(activity.map((a) => a.userId)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', ids);
      (profs ?? []).forEach((p: any) => {
        nameById.set(p.id, p.username);
        avatarById.set(p.id, p.avatar_url);
      });
    }
  }

  // For you: books in my favourite genres that I haven't shelved yet.
  const { data: myGenreRows } = await supabase
    .from('profile_genres')
    .select('genre')
    .eq('user_id', user.id);
  const mySlugs = (myGenreRows ?? []).map((r: any) => r.genre);

  const { data: myEntries } = await supabase
    .from('reading_entries')
    .select('book_id')
    .eq('user_id', user.id);
  const shelved = new Set((myEntries ?? []).map((r: any) => r.book_id));

  let forYou: CoverItem[] = [];
  if (mySlugs.length) {
    const { data: bgRows } = await supabase
      .from('book_genres')
      .select('book_id')
      .in('genre', mySlugs);
    const recIds = Array.from(new Set((bgRows ?? []).map((r: any) => r.book_id)))
      .filter((id) => !shelved.has(id))
      .slice(0, 12);
    if (recIds.length) {
      const { data: recBooks } = await supabase
        .from('books')
        .select('id, title, author, cover_id')
        .in('id', recIds);
      forYou = (recBooks ?? []).map((b: any) => ({
        bookId: b.id,
        title: b.title,
        author: b.author,
        coverId: b.cover_id,
      }));
    }
  }

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Explore</h1>
        {me?.username && (
          <Link href={`/u/${me.username}`} className="text-sm text-brand hover:underline">
            Your shelf →
          </Link>
        )}
      </header>

      {/* Activity from people you follow */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">From people you follow</h2>
        {activity.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
            {followingIds.length === 0 ? (
              <>
                You&apos;re not following anyone yet.{' '}
                <Link href="/search" className="text-brand underline">
                  Find readers
                </Link>{' '}
                to fill your feed.
              </>
            ) : (
              'No recent activity from the people you follow.'
            )}
          </p>
        ) : (
          <ul className="space-y-2">
            {activity.map((a, i) => {
              const uname = nameById.get(a.userId) ?? 'reader';
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm"
                >
                  <Avatar src={avatarById.get(a.userId) ?? null} name={uname} size={36} />
                  <div className="h-12 w-8 flex-shrink-0 overflow-hidden rounded bg-slate-100">
                    {coverUrl(a.book?.cover_id, 'S') && (
                      <Image
                        src={coverUrl(a.book?.cover_id, 'S') as string}
                        alt=""
                        width={48}
                        height={72}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p className="min-w-0 flex-1 text-stone-700">
                    <Link href={`/u/${uname}`} className="font-medium hover:text-brand hover:underline">
                      @{uname}
                    </Link>{' '}
                    {a.kind === 'shelf' ? (
                      <>
                        {VERB[a.status ?? ''] ?? 'shelved'}{' '}
                        <Link href={`/book/${a.bookId}`} className="font-medium hover:text-brand hover:underline">
                          {a.book?.title}
                        </Link>
                        {a.rating ? (
                          <span className="text-stone-500"> · {Number(a.rating).toFixed(1)}★</span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        reviewed{' '}
                        <Link href={`/book/${a.bookId}`} className="font-medium hover:text-brand hover:underline">
                          {a.book?.title}
                        </Link>
                        {a.body ? (
                          <span className="text-stone-500"> — “{a.body.slice(0, 80)}{a.body.length > 80 ? '…' : ''}”</span>
                        ) : null}
                      </>
                    )}
                    {' '}
                    <span className="whitespace-nowrap text-stone-400">· {timeAgo(a.at)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* For you (genre-based) */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">For you</h2>
        {mySlugs.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
            Tell us what you like —{' '}
            <Link href="/settings" className="text-brand underline">
              pick your favourite genres
            </Link>{' '}
            to get recommendations here.
          </p>
        ) : forYou.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
            Nothing new in your genres yet — as more books are added, picks will
            show up here.
          </p>
        ) : (
          <CoverGrid items={forYou} />
        )}
      </section>

      {/* Trending */}
      {trending.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Trending now</h2>
          <CoverGrid items={trending} />
        </section>
      )}
    </div>
  );
}
