import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import Avatar from '@/components/Avatar';
import PostCard from '@/components/PostCard';
import BookMarquee from '@/components/BookMarquee';
import { timeAgo } from '@/lib/time';
import { loadPostCardInteractions } from '@/lib/post-interactions';
import { htmlToText } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

type CoverItem = {
  bookId: string;
  title?: string | null;
  author?: string | null;
  coverId?: number | null;
};

type ArticlePreview = {
  id: string;
  title: string;
  excerpt: string;
  author: string | null;
  tag: string | null;
};

type Activity = {
  id: string;
  at: string;
  userId: string;
  kind: 'post' | 'article' | 'repost' | 'review' | 'quote' | 'list';
  href?: string;
  title: string;
  body?: string;
  tags?: string[];
  targetUserId?: string | null;
};

type ShelfEntry = {
  book_id: string;
  status: string | null;
  rating: number | null;
  updated_at: string | null;
  books?: {
    title?: string | null;
    author?: string | null;
    cover_id?: number | null;
  } | null;
};

type ShelfCounts = {
  reading: number;
  want_to_read: number;
  read: number;
  dnf: number;
};

function trimText(text: string, max = 120) {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}...` : clean;
}

function articleTitle(text: string) {
  const firstSentence = text.split(/[.!?]\s/)[0] ?? text;
  return trimText(firstSentence, 64) || 'Read the latest article';
}

function activityHref(item: Activity, username: string) {
  return item.href ?? `/u/${username}?tab=posts#profile-content`;
}

function activityVerb(kind: Activity['kind']) {
  switch (kind) {
    case 'article':
      return 'published';
    case 'repost':
      return 'reposted';
    case 'review':
      return 'reviewed';
    case 'quote':
      return 'shared';
    case 'list':
      return 'created';
    default:
      return 'posted';
  }
}

function activityLabel(kind: Activity['kind']) {
  switch (kind) {
    case 'article':
      return 'Article';
    case 'repost':
      return 'Repost';
    case 'review':
      return 'Review';
    case 'quote':
      return 'Quote';
    case 'list':
      return 'List';
    default:
      return 'Post';
  }
}

function FriendsActivityFeed({
  activity,
  followingCount,
  nameById,
  avatarById,
}: {
  activity: Activity[];
  followingCount: number;
  nameById: Map<string, string>;
  avatarById: Map<string, string | null>;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Friends activity</h2>
          <p className="mt-1 text-sm text-stone-500">Public posts, articles, reposts, reviews, quotes, and lists.</p>
        </div>
        <Link href="/" className="text-sm text-brand hover:underline">Back to Explore</Link>
      </div>

      {activity.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
          {followingCount === 0 ? (
            <>
              You&apos;re not following anyone yet.{' '}
              <Link href="/search" className="text-brand underline">
                Find readers
              </Link>{' '}
              to fill your feed.
            </>
          ) : (
            'No public activity from the people you follow yet.'
          )}
        </p>
      ) : (
        <ul className="space-y-3">
          {activity.map((item) => {
            const uname = nameById.get(item.userId) ?? 'reader';
            const targetName = item.targetUserId ? nameById.get(item.targetUserId) : null;
            return (
              <li key={item.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <Avatar src={avatarById.get(item.userId) ?? null} name={uname} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <Link href={`/u/${uname}`} className="font-medium text-stone-800 hover:text-brand hover:underline">
                        @{uname}
                      </Link>
                      <span className="text-stone-500">
                        {activityVerb(item.kind)}
                        {targetName ? ` @${targetName}'s` : ''}
                      </span>
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                        {activityLabel(item.kind)}
                      </span>
                      <span className="text-xs text-stone-400">{timeAgo(item.at)}</span>
                    </div>
                    <Link href={activityHref(item, uname)} className="mt-1 block text-base font-semibold text-stone-800 hover:text-brand hover:underline">
                      {item.title}
                    </Link>
                    {item.body && (
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">
                        {item.body}
                      </p>
                    )}
                    {item.tags?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.tags.slice(0, 4).map((tag) => (
                          <Link key={tag} href={`/search?filter=posts&q=${encodeURIComponent(`#${tag}`)}`} className="text-xs text-brand hover:underline">
                            #{tag}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PopularTagsCard({ tags }: { tags: { tag: string; count: number }[] }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Popular tags</p>
      {tags.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">Tags will appear as posts grow.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map(({ tag }) => (
            <Link
              key={tag}
              href={`/search?filter=posts&q=${encodeURIComponent(`#${tag}`)}`}
              className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-600 transition hover:border-brand hover:text-brand"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function DiscoveryRail({
  article,
  popularTags = [],
}: {
  article: ArticlePreview | null;
  popularTags?: { tag: string; count: number }[];
}) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-24">
      <Link
        href={article ? `/articles#article-${article.id}` : '/articles'}
        className="block rounded-lg border border-stone-200 bg-white p-4 transition hover:border-brand"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Articles</p>
        <h2 className="mt-1 text-base font-semibold text-stone-800">
          {article?.title ?? 'Book essays and criticism'}
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          {article?.excerpt ?? 'Long-form writing from readers, gathered in one place.'}
        </p>
        <p className="mt-3 text-xs text-brand">
          {article?.tag ? `#${article.tag}` : 'Open articles'}{article?.author ? ` · @${article.author}` : ''}
        </p>
      </Link>

      <Link
        href="/quotes"
        className="block rounded-lg border border-stone-200 bg-white p-4 transition hover:border-brand"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Quotes</p>
        <h2 className="mt-1 text-base font-semibold text-stone-800">Save lines worth keeping</h2>
        <p className="mt-2 text-sm text-stone-500">
          Keep book quotes, notes, sources, and tags in your private quote shelf.
        </p>
        <p className="mt-3 text-xs text-brand">Open quotes</p>
      </Link>

      <PopularTagsCard tags={popularTags} />
    </aside>
  );
}

function ExploreRightRail({
  username,
  shelfCounts,
  shelfTotal,
  ratedCount,
  averageRating,
  currentRead,
  activity,
  nameById,
  avatarById,
}: {
  username: string | null | undefined;
  shelfCounts: ShelfCounts;
  shelfTotal: number;
  ratedCount: number;
  averageRating: number | null;
  currentRead: ShelfEntry | null;
  activity: Activity[];
  nameById: Map<string, string>;
  avatarById: Map<string, string | null>;
}) {
  const shelfHref = username ? `/u/${username}?tab=shelf#profile-shelf` : '/settings/import';
  const shelfRows = [
    ['Reading', shelfCounts.reading],
    ['Want', shelfCounts.want_to_read],
    ['Read', shelfCounts.read],
    ['DNF', shelfCounts.dnf],
  ] as const;

  return (
    <aside className="hidden space-y-3 xl:block xl:sticky xl:top-24">
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Your shelf</p>
          <Link href={shelfHref} className="text-xs font-medium text-brand hover:underline">
            Open
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {shelfRows.map(([label, count]) => (
            <div key={label} className="rounded border border-stone-200 px-3 py-2">
              <p className="text-lg font-semibold leading-none text-stone-800">{count}</p>
              <p className="mt-1 text-[11px] text-stone-500">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-stone-500">
          {averageRating == null
            ? `${shelfTotal} books shelved`
            : `${averageRating.toFixed(1)}★ avg from ${ratedCount} ratings`}
        </p>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Continue</p>
        {currentRead ? (
          <Link href={`/book/${currentRead.book_id}`} className="mt-3 flex gap-3 hover:text-brand">
            <div className="book-cover-fallback h-20 w-14 flex-shrink-0 overflow-hidden rounded">
              {coverUrl(currentRead.books?.cover_id, 'S') && (
                <Image
                  src={coverUrl(currentRead.books?.cover_id, 'S') as string}
                  alt=""
                  width={56}
                  height={84}
                  className="relative z-10 h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="line-clamp-3 text-sm font-semibold text-stone-800">{currentRead.books?.title ?? 'Current read'}</p>
              <p className="mt-1 line-clamp-2 text-xs text-stone-500">{currentRead.books?.author}</p>
            </div>
          </Link>
        ) : (
          <p className="mt-2 text-sm text-stone-500">No current read yet.</p>
        )}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/?view=friends" className="text-xs font-semibold uppercase tracking-wide text-stone-400 hover:text-brand">
            Friends activity
          </Link>
          <Link href="/?view=friends" className="text-xs font-medium text-brand hover:underline">
            View
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Follow readers to fill this.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {activity.slice(0, 7).map((item) => {
              const uname = nameById.get(item.userId) ?? 'reader';
              const targetName = item.targetUserId ? nameById.get(item.targetUserId) : null;
              return (
                <li key={item.id} className="flex gap-2">
                  <Avatar src={avatarById.get(item.userId) ?? null} name={uname} size={28} />
                  <p className="min-w-0 flex-1 text-xs leading-5 text-stone-600">
                    <Link href={`/u/${uname}`} className="font-medium text-stone-800 hover:text-brand hover:underline">
                      @{uname}
                    </Link>{' '}
                    {activityVerb(item.kind)}
                    {targetName ? (
                      <>
                        {' '}
                        <Link href={`/u/${targetName}`} className="font-medium text-stone-800 hover:text-brand hover:underline">
                          @{targetName}
                        </Link>
                        &apos;s
                      </>
                    ) : null}{' '}
                    <Link href={activityHref(item, uname)} className="font-medium text-stone-800 hover:text-brand hover:underline">
                      {item.title}
                    </Link>
                    <span className="text-stone-400"> · {timeAgo(item.at)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}

function CoverGrid({ items }: { items: CoverItem[] }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {items.map((it) => {
        const src = coverUrl(it.coverId, 'M');
        const fallback = (it.title ?? 'Book').slice(0, 36);
        return (
          <li key={it.bookId}>
            <Link href={`/book/${it.bookId}`} className="group flex flex-col">
              <div className="book-cover-fallback aspect-[2/3] w-full overflow-hidden rounded group-hover:opacity-90">
                <span aria-hidden="true" className="absolute inset-2 z-0 flex items-center justify-center overflow-hidden text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-stone-600">
                  {fallback}
                </span>
                {src && (
                  <Image
                    src={src}
                    alt={it.title ?? ''}
                    width={200}
                    height={300}
                    className="relative z-10 h-full w-full object-cover"
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

export default async function ExplorePage({
  searchParams,
}: {
  searchParams?: { view?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const friendsView = searchParams?.view === 'friends';

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
  const trendingItems = Array.from(tally.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)
    .map((t) => t.item);
  const trendingTop = trendingItems.filter((_, i) => i % 2 === 0);
  const trendingBottom = trendingItems.filter((_, i) => i % 2 === 1);

  // A featured list that changes each load (force-dynamic). Picks a random
  // list that has books in it.
  let featured: { id: string; title: string; ownerName: string | null; items: CoverItem[] } | null = null;
  {
    const { data: ls } = await supabase
      .from('lists')
      .select('id, title, owner_id')
      .order('created_at', { ascending: false })
      .limit(60);
    const all = (ls ?? []).slice().sort(() => Math.random() - 0.5).slice(0, 8);
    if (all.length) {
      // One query for the items of all candidate lists, then pick a random
      // one that actually has books (was up to 6 sequential queries before).
      const { data: its } = await supabase
        .from('list_items')
        .select('list_id, position, book_id, books ( title, author, cover_id )')
        .in('list_id', all.map((l: any) => l.id))
        .order('position', { ascending: true });
      const byList = new Map<string, any[]>();
      (its ?? []).forEach((it: any) => {
        const arr = byList.get(it.list_id) ?? [];
        if (arr.length < 12) arr.push(it);
        byList.set(it.list_id, arr);
      });
      const chosen = all.find((l: any) => (byList.get(l.id)?.length ?? 0) > 0);
      if (chosen) {
        let ownerName: string | null = null;
        if (chosen.owner_id) {
          const { data: o } = await supabase.from('profiles').select('username').eq('id', chosen.owner_id).maybeSingle();
          ownerName = o?.username ?? null;
        }
        featured = {
          id: chosen.id,
          title: chosen.title,
          ownerName,
          items: (byList.get(chosen.id) ?? []).map((it: any) => ({ bookId: it.book_id, title: it.books?.title, author: it.books?.author, coverId: it.books?.cover_id })),
        };
      }
    }
  }

  const { data: latestArticleRows } = await supabase
    .from('posts')
    .select('id, user_id, body_html, body_text, tags, created_at')
    .eq('is_article', true)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(1);
  const latestArticle = latestArticleRows?.[0] as any | undefined;
  let articlePreview: ArticlePreview | null = null;
  if (latestArticle) {
    let author: string | null = null;
    const { data: articleAuthor } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', latestArticle.user_id)
      .maybeSingle();
    author = articleAuthor?.username ?? null;

    const text = String(latestArticle.body_text ?? '').trim() || htmlToText(latestArticle.body_html ?? '');
    articlePreview = {
      id: latestArticle.id,
      title: articleTitle(text),
      excerpt: trimText(text, 118),
      author,
      tag: Array.isArray(latestArticle.tags) && latestArticle.tags.length ? latestArticle.tags[0] : null,
    };
  }

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

        <DiscoveryRail article={articlePreview} />

        {trendingItems.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Trending now</h2>
            <div className="space-y-3">
              <BookMarquee items={trendingTop} />
              <BookMarquee items={trendingBottom} reverse />
            </div>
          </section>
        )}

        {featured && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-lg font-semibold">
                From the lists: <Link href={`/list/${featured.id}`} className="text-brand hover:underline">{featured.title}</Link>
              </h2>
              <Link href="/lists" className="whitespace-nowrap text-sm text-brand hover:underline">All lists →</Link>
            </div>
            <CoverGrid items={featured.items} />
          </section>
        )}
      </div>
    );
  }

  // --- Logged-in feed -------------------------------------------------
  // Independent — fetch the viewer's profile + who they follow together.
  const [meRes, followingRowsRes, blockRowsRes] = await Promise.all([
    supabase.from('profiles').select('username, display_name').eq('id', user.id).maybeSingle(),
    supabase.from('follows').select('followee_id').eq('follower_id', user.id),
    supabase
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
  ]);
  const me = meRes.data;
  const blockedIds = new Set<string>();
  (blockRowsRes.data ?? []).forEach((row: any) => {
    if (row.blocker_id === user.id) blockedIds.add(row.blocked_id);
    if (row.blocked_id === user.id) blockedIds.add(row.blocker_id);
  });
  const followingIds = (followingRowsRes.data ?? [])
    .map((r: any) => r.followee_id)
    .filter((id: string) => !blockedIds.has(id));

  // Friends activity: public content signals only. No likes, comments,
  // replies, diary, or shelf updates.
  let activity: Activity[] = [];
  const nameById = new Map<string, string>();
  const avatarById = new Map<string, string | null>();

  if (followingIds.length) {
    const [
      { data: postRows },
      { data: reviewRows },
      { data: repostRows },
      { data: quoteRows },
      { data: listRows },
    ] = await Promise.all([
      supabase
        .from('posts')
        .select('id, user_id, body_html, body_text, is_article, tags, created_at')
        .in('user_id', followingIds)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(35),
      supabase
        .from('reviews')
        .select('id, user_id, body, created_at, book_id, books ( title )')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('post_reposts')
        .select('post_id, user_id, created_at')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('quotes')
        .select('id, user_id, body, source_title, source_author, tags, created_at')
        .in('user_id', followingIds)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('lists')
        .select('id, owner_id, title, description, created_at')
        .in('owner_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    const repostPostIds = Array.from(new Set((repostRows ?? []).map((row: any) => row.post_id)));
    const { data: repostedPosts } = repostPostIds.length
      ? await supabase
          .from('posts')
          .select('id, user_id, body_html, body_text, is_article, tags, status, created_at')
          .in('id', repostPostIds)
          .eq('status', 'published')
      : { data: [] as any[] };
    const repostedById = new Map((repostedPosts ?? []).map((post: any) => [post.id, post]));

    activity = [
      ...((postRows ?? []).map((post: any) => {
        const text = String(post.body_text ?? '').trim() || htmlToText(post.body_html ?? '');
        return {
          id: `post-${post.id}`,
          at: post.created_at,
          userId: post.user_id,
          kind: post.is_article ? 'article' : 'post',
          href: post.is_article ? `/articles#article-${post.id}` : undefined,
          title: post.is_article ? articleTitle(text) : 'a post',
          body: trimText(text, post.is_article ? 180 : 160),
          tags: Array.isArray(post.tags) ? post.tags : [],
        };
      })),
      ...((reviewRows ?? []).map((r: any) => ({
        id: `review-${r.id}`,
        at: r.created_at,
        userId: r.user_id,
        kind: 'review' as const,
        href: `/book/${r.book_id}`,
        title: r.books?.title ?? 'a book',
        body: trimText(String(r.body ?? ''), 170),
      }))),
      ...(((repostRows ?? []).map((row: any) => {
        const post = repostedById.get(row.post_id) as any;
        if (!post) return null;
        const text = String(post.body_text ?? '').trim() || htmlToText(post.body_html ?? '');
        return {
          id: `repost-${row.user_id}-${row.post_id}`,
          at: row.created_at,
          userId: row.user_id,
          kind: 'repost' as const,
          href: post.is_article ? `/articles#article-${post.id}` : undefined,
          title: post.is_article ? articleTitle(text) : 'a post',
          body: trimText(text, 160),
          tags: Array.isArray(post.tags) ? post.tags : [],
          targetUserId: post.user_id,
        };
      }).filter(Boolean)) as Activity[]),
      ...((quoteRows ?? []).map((quote: any) => ({
        id: `quote-${quote.id}`,
        at: quote.created_at,
        userId: quote.user_id,
        kind: 'quote' as const,
        title: quote.source_title ?? 'a quote',
        body: trimText(String(quote.body ?? ''), 180),
        tags: Array.isArray(quote.tags) ? quote.tags : [],
      }))),
      ...((listRows ?? []).map((list: any) => ({
        id: `list-${list.id}`,
        at: list.created_at,
        userId: list.owner_id,
        kind: 'list' as const,
        href: `/list/${list.id}`,
        title: list.title,
        body: trimText(String(list.description ?? ''), 160),
      }))),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 30) as Activity[];

    const ids = Array.from(new Set(activity.flatMap((a) => [a.userId, a.targetUserId].filter(Boolean) as string[])));
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
  const [{ data: myGenreRows }, { data: myEntries }] = await Promise.all([
    supabase
      .from('profile_genres')
      .select('genre')
      .eq('user_id', user.id),
    supabase
      .from('reading_entries')
      .select('book_id, status, rating, updated_at, books ( title, author, cover_id )')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
  ]);
  const mySlugs = (myGenreRows ?? []).map((r: any) => r.genre);
  const shelfEntries = ((myEntries ?? []) as any[]) as ShelfEntry[];
  const shelved = new Set(shelfEntries.map((r) => r.book_id));
  const shelfCounts: ShelfCounts = { reading: 0, want_to_read: 0, read: 0, dnf: 0 };
  for (const entry of shelfEntries) {
    if (entry.status === 'reading' || entry.status === 'want_to_read' || entry.status === 'read' || entry.status === 'dnf') {
      shelfCounts[entry.status] += 1;
    }
  }
  const ratedEntries = shelfEntries.filter((entry) => entry.rating != null);
  const averageRating = ratedEntries.length
    ? ratedEntries.reduce((sum, entry) => sum + Number(entry.rating), 0) / ratedEntries.length
    : null;
  const currentRead = shelfEntries.find((entry) => entry.status === 'reading') ?? null;

  let forYou: CoverItem[] = [];
  if (mySlugs.length) {
    const { data: bgRows } = await supabase
      .from('book_genres')
      .select('book_id')
      .in('genre', mySlugs)
      .limit(120);
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

  // Short-form posts feed (articles live on /articles)
  const { data: shortPostsData } = await supabase
    .from('posts')
    .select('*')
    .eq('is_article', false)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(15);
  const shortPosts = shortPostsData ?? [];
  const tagTally = new Map<string, number>();
  for (const post of shortPosts as any[]) {
    for (const tag of post.tags ?? []) {
      tagTally.set(tag, (tagTally.get(tag) ?? 0) + 1);
    }
  }
  if (articlePreview?.tag) tagTally.set(articlePreview.tag, (tagTally.get(articlePreview.tag) ?? 0) + 1);
  const popularTags = Array.from(tagTally.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));
  const postAuthors = new Map<string, any>();
  const authorIds = Array.from(new Set(shortPosts.map((p: any) => p.user_id)));
  const [authorsRes, shortPostInteractions] = await Promise.all([
    authorIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', authorIds)
      : Promise.resolve({ data: [] as any[] }),
    loadPostCardInteractions(supabase, shortPosts),
  ]);
  (authorsRes.data ?? []).forEach((a: any) => postAuthors.set(a.id, a));

  return (
    <div className="relative left-1/2 w-[min(100vw-2rem,1360px)] -translate-x-1/2 space-y-10">
      <header>
        <h1 className="text-2xl font-bold">Explore</h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <DiscoveryRail article={articlePreview} popularTags={popularTags} />

        <div className="min-w-0 space-y-10">
          {friendsView ? (
            <FriendsActivityFeed
              activity={activity}
              followingCount={followingIds.length}
              nameById={nameById}
              avatarById={avatarById}
            />
          ) : (
            <>

      {/* Trending now — two opposite-scrolling rows */}
      {trendingItems.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Trending now</h2>
          <div className="space-y-3">
            <BookMarquee items={trendingTop} />
            <BookMarquee items={trendingBottom} reverse />
          </div>
        </section>
      )}

      {/* Featured list (changes each visit) */}
      {featured && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-lg font-semibold">
              From the lists: <Link href={`/list/${featured.id}`} className="text-brand hover:underline">{featured.title}</Link>
            </h2>
            <Link href="/lists" className="whitespace-nowrap text-sm text-brand hover:underline">All lists →</Link>
          </div>
          <CoverGrid items={featured.items} />
        </section>
      )}

      {/* Latest short-form posts */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Latest posts</h2>
        {shortPosts.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
            No posts yet — write one from your profile.
          </p>
        ) : (
          <ul className="space-y-3">
            {shortPosts.map((p: any) => (
              <li key={p.id}>
                <PostCard
                  post={p}
                  author={postAuthors.get(p.user_id)}
                  viewerId={user.id}
                  interactions={shortPostInteractions.get(p.id)}
                />
              </li>
            ))}
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
            </>
          )}

        </div>
        <ExploreRightRail
          username={me?.username}
          shelfCounts={shelfCounts}
          shelfTotal={shelfEntries.length}
          ratedCount={ratedEntries.length}
          averageRating={averageRating}
          currentRead={currentRead}
          activity={activity}
          nameById={nameById}
          avatarById={avatarById}
        />
      </div>

    </div>
  );
}
