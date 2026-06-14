import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import { followUser, unfollowUser } from '@/app/actions/follows';
import { genreName } from '@/lib/genres';
import { timeAgo, formatDate } from '@/lib/time';
import Avatar from '@/components/Avatar';
import ShareButton from '@/components/ShareButton';
import PostComposer from '@/components/PostComposer';
import PostCard from '@/components/PostCard';

function linkifyMentions(text: string, valid: Set<string>): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /@([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const uname = m[1];
    if (valid.has(uname.toLowerCase())) {
      parts.push(<Link key={key++} href={`/u/${uname}`} className="font-medium text-brand hover:underline">@{uname}</Link>);
    } else {
      parts.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const STATUS_LABEL: Record<string, string> = {
  want_to_read: 'Want to read',
  reading: 'Reading',
  read: 'Read',
  dnf: 'Did not finish',
};
const STATUS_ORDER = ['reading', 'want_to_read', 'read', 'dnf'];
const TAB_BAR = ['posts', 'likes', 'replies', 'reviews'] as const;
const ALL_TABS = ['posts', 'likes', 'replies', 'reviews', 'diary', 'shelf'];
type Tab = 'posts' | 'likes' | 'replies' | 'reviews' | 'diary' | 'shelf';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { tag?: string; tab?: string; all?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, website, twitter, instagram, avatar_url, likes_visibility, comments_visibility')
    .eq('username', params.username)
    .maybeSingle();
  if (!profile) notFound();

  const tab: Tab = (ALL_TABS.includes(searchParams?.tab ?? '') ? searchParams!.tab : 'posts') as Tab;
  const tagFilter = searchParams?.tag ?? null;

  const { data: entries } = await supabase
    .from('reading_entries')
    .select('status, rating, book_id, books ( title, author, cover_id )')
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false });
  const list = entries ?? [];

  const { data: genreRows } = await supabase.from('profile_genres').select('genre').eq('user_id', profile.id);
  const favGenres = (genreRows ?? []).map((r: any) => r.genre);

  const mentioned = Array.from(
    new Set((profile.bio?.match(/@([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)/g) ?? []).map((t: string) => t.slice(1)))
  );
  let validMentions = new Set<string>();
  if (mentioned.length) {
    const { data: mp } = await supabase.from('profiles').select('username').in('username', mentioned);
    validMentions = new Set((mp ?? []).map((r: any) => String(r.username).toLowerCase()));
  }

  const { data: favRows } = await supabase
    .from('favorite_books')
    .select('position, book_id, books ( title, author, cover_id )')
    .eq('user_id', profile.id)
    .order('position');
  const favs = favRows ?? [];

  // Recent diary entries for the sidebar preview (newest first).
  const { data: diaryRows } = await supabase
    .from('diary_entries')
    .select('id, read_on, rating, book_id, books ( title, cover_id )')
    .eq('user_id', profile.id)
    .order('read_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(12);
  const diaryPreview = diaryRows ?? [];

  // Books logged this calendar year (diary entries; rereads count too).
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const { count: thisYearCount } = await supabase
    .from('diary_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .gte('read_on', yearStart);

  // Reading goals (this year) + logged hours for the goal bars.
  const yearNum = new Date().getFullYear();
  const { data: goalsRow } = await supabase
    .from('reading_goals')
    .select('books_goal, hours_goal')
    .eq('user_id', profile.id)
    .eq('year', yearNum)
    .maybeSingle();
  const booksGoal = goalsRow?.books_goal ?? 0;
  const hoursGoal = Number(goalsRow?.hours_goal ?? 0);
  const { data: sessionRows } = await supabase
    .from('reading_sessions')
    .select('hours')
    .eq('user_id', profile.id)
    .gte('created_at', yearStart);
  const hoursThisYear = (sessionRows ?? []).reduce((sum: number, r: any) => sum + Number(r.hours), 0);
  const booksThisYear = thisYearCount ?? 0;
  const pctBooks = booksGoal > 0 ? Math.min(100, (booksThisYear / booksGoal) * 100) : 0;
  const pctHours = hoursGoal > 0 ? Math.min(100, (hoursThisYear / hoursGoal) * 100) : 0;

  const { data: followerRows } = await supabase.from('follows').select('follower_id').eq('followee_id', profile.id);
  const { data: followingRows } = await supabase.from('follows').select('followee_id').eq('follower_id', profile.id);
  const followerIds = (followerRows ?? []).map((r: any) => r.follower_id);
  const followingSet = new Set((followingRows ?? []).map((r: any) => r.followee_id));
  const friendCount = followerIds.filter((id: string) => followingSet.has(id)).length;

  const isOwnProfile = user?.id === profile.id;
  const isFollowing = !!user && !isOwnProfile && followerIds.includes(user.id);
  const isFriend = !!user && isFollowing && followingSet.has(user.id);
  const canSee = (vis: string) => isOwnProfile || vis === 'public' || (vis === 'friends' && isFriend);
  const canLikes = canSee(profile.likes_visibility ?? 'public');
  const canReplies = canSee(profile.comments_visibility ?? 'public');

  async function loadPosts(ids: string[]) {
    if (!ids.length) return { posts: [] as any[], authors: new Map<string, any>() };
    const { data } = await supabase.from('posts').select('*').in('id', ids);
    const order = new Map(ids.map((id, i) => [id, i]));
    const posts = (data ?? []).sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const aIds = Array.from(new Set(posts.map((p: any) => p.user_id)));
    const authors = new Map<string, any>();
    if (aIds.length) {
      const { data: au } = await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', aIds);
      (au ?? []).forEach((a: any) => authors.set(a.id, a));
    }
    return { posts, authors };
  }

  // ---- Tab data ----
  let feed: any[] = [];
  let repostAuthors = new Map<string, any>();
  let topTags: string[] = [];
  let likeItems: { posts: any[]; authors: Map<string, any> } = { posts: [], authors: new Map() };
  let replyItems: any[] = [];
  let replyOwner = new Map<string, string>();
  let reviews: any[] = [];
  let diary: any[] = [];

  if (tab === 'posts') {
    const { data: op } = await supabase.from('posts').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    const originals = op ?? [];
    const { data: rr } = await supabase.from('post_reposts').select('post_id, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    const loaded = await loadPosts((rr ?? []).map((r: any) => r.post_id));
    repostAuthors = loaded.authors;
    const rMap = new Map(loaded.posts.map((p: any) => [p.id, p]));
    feed = [
      ...originals.map((p: any) => ({ kind: 'post', at: p.created_at, post: p })),
      ...(rr ?? []).map((r: any) => {
        const p = rMap.get(r.post_id);
        return p ? { kind: 'repost', at: r.created_at, post: p } : null;
      }).filter(Boolean),
    ].sort((a: any, b: any) => (a.at < b.at ? 1 : -1));
    if (tagFilter) feed = feed.filter((it: any) => (it.post.tags ?? []).includes(tagFilter));

    const { data: tagRows } = await supabase.from('posts').select('tags').eq('user_id', profile.id).limit(200);
    const tally = new Map<string, number>();
    (tagRows ?? []).forEach((p: any) => (p.tags ?? []).forEach((t: string) => tally.set(t, (tally.get(t) ?? 0) + 1)));
    topTags = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  } else if (tab === 'likes' && canLikes) {
    const { data: lr } = await supabase.from('post_reactions').select('post_id').eq('user_id', profile.id).eq('type', 'like').limit(30);
    likeItems = await loadPosts((lr ?? []).map((r: any) => r.post_id));
  } else if (tab === 'replies' && canReplies) {
    const { data: cc } = await supabase.from('post_comments').select('id, post_id, body, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    replyItems = cc ?? [];
    const pids = Array.from(new Set(replyItems.map((c: any) => c.post_id)));
    if (pids.length) {
      const { data: ps } = await supabase.from('posts').select('id, user_id').in('id', pids);
      const ownerIds = Array.from(new Set((ps ?? []).map((p: any) => p.user_id)));
      const uname = new Map<string, string>();
      if (ownerIds.length) {
        const { data: pr } = await supabase.from('profiles').select('id, username').in('id', ownerIds);
        (pr ?? []).forEach((p: any) => uname.set(p.id, p.username));
      }
      (ps ?? []).forEach((p: any) => replyOwner.set(p.id, uname.get(p.user_id) ?? ''));
    }
  } else if (tab === 'reviews') {
    const { data: rv } = await supabase.from('reviews').select('id, body, book_id, created_at, books ( title )').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    reviews = rv ?? [];
  } else if (tab === 'diary') {
    const { data: dv } = await supabase
      .from('diary_entries')
      .select('id, read_on, rating, note, is_reread, book_id, books ( title, author, cover_id )')
      .eq('user_id', profile.id)
      .order('read_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(60);
    diary = dv ?? [];
  }

  // Group the diary preview by calendar month for the sidebar card.
  const diaryByMonth: { key: string; label: string; items: any[] }[] = [];
  {
    const map = new Map<string, any[]>();
    diaryPreview.forEach((d: any) => {
      const key = String(d.read_on).slice(0, 7); // "YYYY-MM"
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    Array.from(map.entries()).forEach(([key, items]) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
      diaryByMonth.push({ key, label, items });
    });
  }

  // Ratings distribution: ten half-star buckets (0.5 .. 5.0) from shelf ratings.
  const ratingValues = list
    .map((e: any) => e.rating)
    .filter((r: any) => r != null)
    .map((r: any) => Number(r));
  const ratingBuckets = Array.from({ length: 10 }, () => 0);
  ratingValues.forEach((r: number) => {
    const idx = Math.min(9, Math.max(0, Math.round(r * 2) - 1)); // 0.5->0 ... 5.0->9
    ratingBuckets[idx]++;
  });
  const maxBucket = Math.max(1, ...ratingBuckets);

  // Recently read: newest diary logs first (distinct books), then fall back
  // to recently-read shelf books so the row is populated even without a diary.
  const recentSeen = new Set<string>();
  const recentRead: { book_id: string; title?: string; cover_id?: number | null; rating?: number | null }[] = [];
  diaryPreview.forEach((d: any) => {
    if (recentSeen.has(d.book_id)) return;
    recentSeen.add(d.book_id);
    recentRead.push({ book_id: d.book_id, title: d.books?.title, cover_id: d.books?.cover_id, rating: d.rating });
  });
  list
    .filter((e: any) => e.status === 'read')
    .forEach((e: any) => {
      if (recentRead.length >= 4 || recentSeen.has(e.book_id)) return;
      recentSeen.add(e.book_id);
      recentRead.push({ book_id: e.book_id, title: e.books?.title, cover_id: e.books?.cover_id, rating: e.rating });
    });
  const recentReadRow = recentRead.slice(0, 4);

  const grouped = STATUS_ORDER.map((status) => ({ status, items: list.filter((e: any) => e.status === status) })).filter((g) => g.items.length > 0);
  const connHref = (t: string) => `/u/${profile.username}/connections?type=${t}`;
  const tabHref = (t: string) => `/u/${profile.username}?tab=${t}`;
  const TAB_LABEL: Record<string, string> = { posts: 'Posts', likes: 'Likes', replies: 'Replies', reviews: 'Reviews', diary: 'Diary' };

  // Header stat blocks (Letterboxd-style: big number + small label).
  const stats: { label: string; value: number; href: string }[] = [
    { label: 'Books', value: list.length, href: `/u/${profile.username}?tab=shelf` },
    { label: 'This year', value: thisYearCount ?? 0, href: `/u/${profile.username}?tab=diary` },
    { label: 'Friends', value: friendCount, href: connHref('friends') },
    { label: 'Following', value: followingSet.size, href: connHref('following') },
    { label: 'Followers', value: followerIds.length, href: connHref('followers') },
  ];

  return (
    <div>
      {/* --- Profile header (Letterboxd-style: avatar + name/actions left, stats right) --- */}
      <div className="flex items-start gap-4">
        <Avatar src={profile.avatar_url} name={profile.display_name ?? profile.username} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            {/* Name + actions */}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">{profile.display_name ?? profile.username}</h1>
              <p className="text-sm text-slate-500">@{profile.username}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ShareButton username={profile.username} />
                {isOwnProfile ? (
                  <Link href="/settings/profile" className="whitespace-nowrap rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Edit profile</Link>
                ) : user ? (
                  <>
                    <Link href={`/messages/${profile.username}`} className="whitespace-nowrap rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Message</Link>
                    <form action={isFollowing ? unfollowUser : followUser}>
                      <input type="hidden" name="followeeId" value={profile.id} />
                      <input type="hidden" name="username" value={profile.username} />
                      <button className={isFollowing ? 'rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100' : 'rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90'}>{isFollowing ? 'Following' : 'Follow'}</button>
                    </form>
                  </>
                ) : null}
              </div>
            </div>

            {/* Stat blocks + public goal bars */}
            <div className="flex flex-shrink-0 flex-col gap-3">
              <div className="flex flex-wrap items-start justify-end gap-x-6 gap-y-3">
                {stats.map((st) => (
                  <Link key={st.label} href={st.href} className="group text-center">
                    <div className="text-xl font-bold leading-tight text-slate-800 group-hover:text-brand">{st.value.toLocaleString()}</div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 group-hover:text-brand">{st.label}</div>
                  </Link>
                ))}
              </div>

              {(booksGoal > 0 || hoursGoal > 0) ? (
                <div className="space-y-1.5 sm:min-w-[260px]">
                  <div>
                    <div className="mb-0.5 flex items-center justify-between text-xs text-stone-500">
                      <span>Books this year</span>
                      <span className="font-medium text-stone-700">{booksThisYear}{booksGoal > 0 ? ` / ${booksGoal}` : ''}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-soft">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pctBooks}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 flex items-center justify-between text-xs text-stone-500">
                      <span>Hours this year</span>
                      <span className="font-medium text-stone-700">{hoursThisYear.toFixed(1)}{hoursGoal > 0 ? ` / ${hoursGoal}` : ''}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-soft">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pctHours}%` }} />
                    </div>
                  </div>
                  {isOwnProfile && (
                    <Link href="/goals" className="inline-block text-xs text-brand hover:underline">Manage goals →</Link>
                  )}
                </div>
              ) : isOwnProfile ? (
                <Link href="/goals" className="text-right text-xs text-brand hover:underline">Set reading goals →</Link>
              ) : null}
            </div>
          </div>

          {/* Bio + social + genres */}
          {profile.bio && <p className="mt-3 whitespace-pre-wrap text-slate-700">{linkifyMentions(profile.bio, validMentions)}</p>}
          {(profile.website || profile.instagram || profile.twitter) && (
            <p className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Website</a>}
              {profile.instagram && (
                <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-brand hover:opacity-70">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" /></svg>
                </a>
              )}
              {profile.twitter && (
                <a href={`https://x.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" aria-label="X" className="text-brand hover:opacity-70">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </a>
              )}
            </p>
          )}
          {favGenres.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {favGenres.map((slug: string) => <span key={slug} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">{genreName(slug)}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* --- Favourites + Shelf (same line) --- */}
      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          {favs.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Favourites</h2>
              <ul className="grid max-w-md grid-cols-4 gap-3">
                {favs.map((f: any) => {
                  const src = coverUrl(f.books?.cover_id, 'M');
                  return (
                    <li key={f.position}>
                      <Link href={`/book/${f.book_id}`} className="group block">
                        <div className="aspect-[2/3] w-full overflow-hidden rounded bg-slate-100 group-hover:opacity-90">
                          {src && <Image src={src} alt={f.books?.title ?? ''} width={200} height={300} className="h-full w-full object-cover" />}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {recentReadRow.length > 0 && (
            <section className={favs.length > 0 ? 'mt-8' : ''}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Recently read</h2>
              <ul className="grid max-w-md grid-cols-4 gap-3">
                {recentReadRow.map((b) => {
                  const src = coverUrl(b.cover_id, 'M');
                  return (
                    <li key={b.book_id}>
                      <Link href={`/book/${b.book_id}`} className="group block">
                        <div className="aspect-[2/3] w-full overflow-hidden rounded bg-slate-100 group-hover:opacity-90">
                          {src && <Image src={src} alt={b.title ?? ''} width={200} height={300} className="h-full w-full object-cover" />}
                        </div>
                        {b.rating != null && <p className="mt-1 text-center text-xs text-stone-500">{Number(b.rating)}★</p>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
        <aside className="space-y-4 sm:w-44 sm:flex-shrink-0">
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700">Shelf</h3>
              <Link href={`/u/${profile.username}?tab=shelf`} className="text-xs text-brand hover:underline">Visit shelf →</Link>
            </div>
            {list.length === 0 ? (
              <p className="text-xs text-stone-400">No books yet.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-1.5">
                {list.slice(0, 6).map((e: any, i: number) => {
                  const src = coverUrl(e.books?.cover_id, 'M');
                  return (
                    <li key={i}>
                      <Link href={`/book/${e.book_id}`} title={e.books?.title} className="block">
                        <div className="aspect-[2/3] w-full overflow-hidden rounded bg-slate-100 hover:opacity-90">
                          {src && <Image src={src} alt={e.books?.title ?? ''} width={120} height={180} className="h-full w-full object-cover" />}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Diary preview — Letterboxd-style, grouped by month */}
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700">Diary</h3>
              <Link href={`/u/${profile.username}?tab=diary`} className="text-xs text-brand hover:underline">Visit diary →</Link>
            </div>
            {diaryPreview.length === 0 ? (
              <p className="text-xs text-stone-400">No entries yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {diaryByMonth.map((g) => (
                  <li key={g.key} className="flex gap-2">
                    <span className="w-8 flex-shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">{g.label}</span>
                    <ul className="min-w-0 flex-1 space-y-1">
                      {g.items.map((d: any) => (
                        <li key={d.id} className="flex gap-2">
                          <span className="w-4 flex-shrink-0 text-right text-xs text-stone-400">{Number(String(d.read_on).slice(8, 10))}</span>
                          <Link href={`/book/${d.book_id}`} title={d.books?.title} className="min-w-0 flex-1 truncate text-stone-700 hover:text-brand hover:underline">{d.books?.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Ratings distribution histogram */}
          {ratingValues.length > 0 && (
            <div className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-700">Ratings</h3>
                <span className="text-xs text-stone-400">{ratingValues.length}</span>
              </div>
              <div className="flex h-16 items-end gap-[3px]">
                {ratingBuckets.map((c, i) => (
                  <div key={i} className="flex h-full flex-1 items-end" title={`${(i + 1) / 2}★ — ${c}`}>
                    <div className="w-full rounded-sm bg-brand" style={{ height: `${(c / maxBucket) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-brand">
                <span>★</span>
                <span>★★★★★</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* --- Tabs --- */}
      <div className="mt-8">
        <div className="min-w-0">
          {/* Tab bar */}
          <div className="flex flex-wrap gap-1 border-b border-stone-200 text-sm">
            {TAB_BAR.map((t) => (
              <Link key={t} href={tabHref(t)} className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 ${tab === t ? 'border-brand font-medium text-brand' : 'border-transparent text-stone-500 hover:text-brand'}`}>
                {TAB_LABEL[t]}
              </Link>
            ))}
          </div>

          <div className="mt-5">
            {/* POSTS (+ reposts) */}
            {tab === 'posts' && (
              <section>
                {isOwnProfile && !tagFilter && <div className="mb-4"><PostComposer /></div>}
                {topTags.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span>Top tags:</span>
                    {topTags.map((t) => (
                      <Link key={t} href={`/u/${profile.username}?tab=posts&tag=${encodeURIComponent(t)}`} className={`rounded-full px-2 py-0.5 ${tagFilter === t ? 'bg-brand text-white' : 'bg-brand-soft text-brand hover:underline'}`}>#{t}</Link>
                    ))}
                    {tagFilter && <Link href={`/u/${profile.username}?tab=posts`} className="text-stone-400 hover:text-brand">clear ✕</Link>}
                  </div>
                )}
                {feed.length === 0 ? (
                  <p className="text-sm text-stone-500">{tagFilter ? `No posts tagged #${tagFilter}.` : 'No posts yet.'}</p>
                ) : (
                  <ul className="space-y-3">
                    {feed.map((it: any) => (
                      <li key={`${it.kind}-${it.post.id}`}>
                        <PostCard
                          post={it.post}
                          author={it.kind === 'repost' ? repostAuthors.get(it.post.user_id) : undefined}
                          showAuthor={it.kind === 'repost'}
                          canDelete={isOwnProfile && it.kind === 'post'}
                          repostedBy={it.kind === 'repost' ? profile.username : null}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* LIKES */}
            {tab === 'likes' && (
              !canLikes ? (
                <p className="text-sm text-stone-500">{profile.likes_visibility === 'friends' ? 'Likes are visible to friends only.' : 'Likes are private.'}</p>
              ) : likeItems.posts.length === 0 ? (
                <p className="text-sm text-stone-500">No liked posts yet.</p>
              ) : (
                <ul className="space-y-3">
                  {likeItems.posts.map((p: any) => <li key={p.id}><PostCard post={p} author={likeItems.authors.get(p.user_id)} /></li>)}
                </ul>
              )
            )}

            {/* REPLIES */}
            {tab === 'replies' && (
              !canReplies ? (
                <p className="text-sm text-stone-500">{profile.comments_visibility === 'friends' ? 'Replies are visible to friends only.' : 'Replies are private.'}</p>
              ) : replyItems.length === 0 ? (
                <p className="text-sm text-stone-500">No replies yet.</p>
              ) : (
                <ul className="space-y-2">
                  {replyItems.map((c: any) => {
                    const owner = replyOwner.get(c.post_id);
                    return (
                      <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                        <p className="text-stone-700">{c.body}</p>
                        <p className="mt-1 text-xs text-stone-400">
                          {owner ? <>on <Link href={`/u/${owner}`} className="hover:text-brand hover:underline">@{owner}</Link>&apos;s post · </> : null}
                          {timeAgo(c.created_at)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )
            )}

            {/* REVIEWS */}
            {tab === 'reviews' && (
              reviews.length === 0 ? (
                <p className="text-sm text-stone-500">No reviews yet.</p>
              ) : (
                <ul className="space-y-3">
                  {reviews.map((r: any) => (
                    <li key={r.id} className="rounded-lg border border-stone-200 bg-white p-4">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Link href={`/book/${r.book_id}`} className="text-sm font-semibold hover:text-brand hover:underline">{r.books?.title}</Link>
                        <span className="flex-shrink-0 text-xs text-stone-400">{timeAgo(r.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-stone-700">{r.body.length > 240 ? r.body.slice(0, 240) + '…' : r.body}</p>
                    </li>
                  ))}
                </ul>
              )
            )}

            {/* DIARY */}
            {tab === 'diary' && (
              diary.length === 0 ? (
                <p className="text-sm text-stone-500">No diary entries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {diary.map((d: any) => {
                    const src = coverUrl(d.books?.cover_id, 'S');
                    return (
                      <li key={d.id} className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3">
                        <Link href={`/book/${d.book_id}`} className="flex-shrink-0">
                          <div className="h-16 w-11 overflow-hidden rounded bg-slate-100">
                            {src && <Image src={src} alt={d.books?.title ?? ''} width={44} height={64} className="h-full w-full object-cover" />}
                          </div>
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={`/book/${d.book_id}`} className="text-sm font-semibold hover:text-brand hover:underline">{d.books?.title}</Link>
                          <p className="text-xs text-stone-400">
                            {formatDate(d.read_on)}
                            {d.is_reread && <span className="ml-2 text-brand">↻ reread</span>}
                            {d.rating != null && <span className="ml-2 text-stone-500">{Number(d.rating)}★</span>}
                          </p>
                          {d.note && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{d.note}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            )}

            {/* SHELF (full, reached via "Visit shelf") */}
            {tab === 'shelf' && (
              list.length === 0 ? (
                <p className="text-sm text-slate-500">No books on this shelf yet.</p>
              ) : (
                <div className="space-y-8">
                  {grouped.map((group) => {
                    const expanded = searchParams?.all === group.status;
                    const shelfItems = expanded ? group.items : group.items.slice(0, 5);
                    return (
                    <section key={group.status}>
                      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{STATUS_LABEL[group.status]} ({group.items.length})</h2>
                      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                        {shelfItems.map((e: any, i: number) => {
                          const src = coverUrl(e.books?.cover_id, 'M');
                          return (
                            <li key={i}>
                              <Link href={`/book/${e.book_id}`} className="group flex flex-col">
                                <div className="aspect-[2/3] w-full overflow-hidden rounded bg-slate-100 group-hover:opacity-90">
                                  {src && <Image src={src} alt={e.books?.title ?? ''} width={200} height={300} className="h-full w-full object-cover" />}
                                </div>
                                <p className="mt-1 truncate text-sm font-medium">{e.books?.title}</p>
                                <p className="truncate text-xs text-slate-500">{e.books?.author}{e.rating ? ` · ${Number(e.rating)}★` : ''}</p>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                      {group.items.length > 5 && (
                        <Link href={`/u/${profile.username}?tab=shelf${expanded ? '' : `&all=${group.status}`}`} className="mt-2 inline-block text-sm text-brand hover:underline">
                          {expanded ? 'Show less' : `See all (${group.items.length}) →`}
                        </Link>
                      )}
                    </section>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
