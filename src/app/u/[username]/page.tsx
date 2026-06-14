import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import { followUser, unfollowUser } from '@/app/actions/follows';
import { genreName } from '@/lib/genres';
import { timeAgo } from '@/lib/time';
import Avatar from '@/components/Avatar';
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
      parts.push(
        <Link key={key++} href={`/u/${uname}`} className="font-medium text-brand hover:underline">@{uname}</Link>
      );
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
const TABS = ['posts', 'reposts', 'likes', 'comments', 'reviews', 'shelf'] as const;
type Tab = (typeof TABS)[number];

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { tag?: string; tab?: string };
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

  const tab: Tab = (TABS as readonly string[]).includes(searchParams?.tab ?? '')
    ? (searchParams!.tab as Tab)
    : 'posts';
  const tagFilter = searchParams?.tag ?? null;

  // Shelf (also gives the book count)
  const { data: entries } = await supabase
    .from('reading_entries')
    .select('status, rating, book_id, books ( title, author, cover_id )')
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false });
  const list = entries ?? [];

  // Favourite genres + bio mentions + favourites
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

  // Follow graph
  const { data: followerRows } = await supabase.from('follows').select('follower_id').eq('followee_id', profile.id);
  const { data: followingRows } = await supabase.from('follows').select('followee_id').eq('follower_id', profile.id);
  const followerIds = (followerRows ?? []).map((r: any) => r.follower_id);
  const followingSet = new Set((followingRows ?? []).map((r: any) => r.followee_id));
  const friendCount = followerIds.filter((id: string) => followingSet.has(id)).length;

  const isOwnProfile = user?.id === profile.id;
  const isFollowing = !!user && !isOwnProfile && followerIds.includes(user.id);
  const isFriend = !!user && isFollowing && followingSet.has(user.id);
  const canSee = (vis: string) =>
    isOwnProfile || vis === 'public' || (vis === 'friends' && isFriend);
  const canLikes = canSee(profile.likes_visibility ?? 'public');
  const canComments = canSee(profile.comments_visibility ?? 'public');

  // Helper: load posts by id (keeping order) + their authors
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
  let posts: any[] = [];
  let topTags: string[] = [];
  let repostItems: { posts: any[]; authors: Map<string, any> } = { posts: [], authors: new Map() };
  let likeItems: { posts: any[]; authors: Map<string, any> } = { posts: [], authors: new Map() };
  let commentItems: any[] = [];
  let commentOwner = new Map<string, string>();
  let reviews: any[] = [];

  if (tab === 'posts') {
    let q = supabase.from('posts').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    if (tagFilter) q = q.contains('tags', [tagFilter]);
    posts = (await q).data ?? [];
    const { data: tagRows } = await supabase.from('posts').select('tags').eq('user_id', profile.id).limit(200);
    const tally = new Map<string, number>();
    (tagRows ?? []).forEach((p: any) => (p.tags ?? []).forEach((t: string) => tally.set(t, (tally.get(t) ?? 0) + 1)));
    topTags = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  } else if (tab === 'reposts') {
    const { data: rr } = await supabase.from('post_reposts').select('post_id').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    repostItems = await loadPosts((rr ?? []).map((r: any) => r.post_id));
  } else if (tab === 'likes' && canLikes) {
    const { data: lr } = await supabase.from('post_reactions').select('post_id').eq('user_id', profile.id).eq('type', 'like').limit(30);
    likeItems = await loadPosts((lr ?? []).map((r: any) => r.post_id));
  } else if (tab === 'comments' && canComments) {
    const { data: cc } = await supabase.from('post_comments').select('id, post_id, body, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    commentItems = cc ?? [];
    const pids = Array.from(new Set(commentItems.map((c: any) => c.post_id)));
    if (pids.length) {
      const { data: ps } = await supabase.from('posts').select('id, user_id').in('id', pids);
      const ownerIds = Array.from(new Set((ps ?? []).map((p: any) => p.user_id)));
      const uname = new Map<string, string>();
      if (ownerIds.length) {
        const { data: pr } = await supabase.from('profiles').select('id, username').in('id', ownerIds);
        (pr ?? []).forEach((p: any) => uname.set(p.id, p.username));
      }
      (ps ?? []).forEach((p: any) => commentOwner.set(p.id, uname.get(p.user_id) ?? ''));
    }
  } else if (tab === 'reviews') {
    const { data: rv } = await supabase.from('reviews').select('id, body, book_id, created_at, books ( title )').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
    reviews = rv ?? [];
  }

  const grouped = STATUS_ORDER.map((status) => ({ status, items: list.filter((e: any) => e.status === status) })).filter((g) => g.items.length > 0);
  const connHref = (t: string) => `/u/${profile.username}/connections?type=${t}`;
  const tabHref = (t: string) => `/u/${profile.username}?tab=${t}`;

  return (
    <div>
      {/* --- Profile header --- */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar src={profile.avatar_url} name={profile.display_name ?? profile.username} size={72} />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{profile.display_name ?? profile.username}</h1>
            <p className="text-sm text-slate-500">@{profile.username}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-500">
              <Link href={connHref('followers')} className="hover:text-brand">
                <span className="font-medium text-slate-700">{followerIds.length}</span> followers
              </Link>
              <Link href={connHref('following')} className="hover:text-brand">
                <span className="font-medium text-slate-700">{followingSet.size}</span> following
              </Link>
              <Link href={connHref('friends')} className="hover:text-brand">
                <span className="font-medium text-slate-700">{friendCount}</span> friends
              </Link>
              <span>
                <span className="font-medium text-slate-700">{list.length}</span> book{list.length === 1 ? '' : 's'}
              </span>
            </p>
            {profile.bio && (
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{linkifyMentions(profile.bio, validMentions)}</p>
            )}
            {(profile.website || profile.instagram || profile.twitter) && (
              <p className="mt-2 flex flex-wrap gap-3 text-sm">
                {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Website</a>}
                {profile.instagram && <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Instagram</a>}
                {profile.twitter && <a href={`https://x.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">X</a>}
              </p>
            )}
            {favGenres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {favGenres.map((slug: string) => (
                  <span key={slug} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">{genreName(slug)}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        {isOwnProfile ? (
          <Link href="/settings/profile" className="whitespace-nowrap rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Edit profile</Link>
        ) : user ? (
          <div className="flex flex-shrink-0 items-center gap-2">
            <Link href={`/messages/${profile.username}`} className="whitespace-nowrap rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Message</Link>
            <form action={isFollowing ? unfollowUser : followUser}>
              <input type="hidden" name="followeeId" value={profile.id} />
              <input type="hidden" name="username" value={profile.username} />
              <button className={isFollowing ? 'rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100' : 'rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90'}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {/* --- Favourites (Top 4) --- */}
      {favs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Favourites</h2>
          <ul className="grid grid-cols-4 gap-3 sm:max-w-md">
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

      {/* --- Tab bar --- */}
      <div className="mt-8 flex flex-wrap gap-1 border-b border-stone-200 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 capitalize ${
              tab === t ? 'border-brand font-medium text-brand' : 'border-transparent text-stone-500 hover:text-brand'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="mt-5">
        {/* POSTS */}
        {tab === 'posts' && (
          <section>
            {isOwnProfile && !tagFilter && (
              <div className="mb-4"><PostComposer /></div>
            )}
            {topTags.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <span>Top tags:</span>
                {topTags.map((t) => (
                  <Link key={t} href={`/u/${profile.username}?tab=posts&tag=${encodeURIComponent(t)}`} className={`rounded-full px-2 py-0.5 ${tagFilter === t ? 'bg-brand text-white' : 'bg-brand-soft text-brand hover:underline'}`}>#{t}</Link>
                ))}
                {tagFilter && <Link href={`/u/${profile.username}?tab=posts`} className="text-stone-400 hover:text-brand">clear ✕</Link>}
              </div>
            )}
            {posts.length === 0 ? (
              <p className="text-sm text-stone-500">{tagFilter ? `No posts tagged #${tagFilter}.` : 'No posts yet.'}</p>
            ) : (
              <ul className="space-y-3">
                {posts.map((p: any) => (
                  <li key={p.id}><PostCard post={p} canDelete={isOwnProfile} showAuthor={false} /></li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* REPOSTS */}
        {tab === 'reposts' && (
          repostItems.posts.length === 0 ? (
            <p className="text-sm text-stone-500">No reposts yet.</p>
          ) : (
            <ul className="space-y-3">
              {repostItems.posts.map((p: any) => (
                <li key={p.id}><PostCard post={p} author={repostItems.authors.get(p.user_id)} repostedBy={profile.username} /></li>
              ))}
            </ul>
          )
        )}

        {/* LIKES */}
        {tab === 'likes' && (
          !canLikes ? (
            <p className="text-sm text-stone-500">{profile.likes_visibility === 'friends' ? 'Likes are visible to friends only.' : 'Likes are private.'}</p>
          ) : likeItems.posts.length === 0 ? (
            <p className="text-sm text-stone-500">No liked posts yet.</p>
          ) : (
            <ul className="space-y-3">
              {likeItems.posts.map((p: any) => (
                <li key={p.id}><PostCard post={p} author={likeItems.authors.get(p.user_id)} /></li>
              ))}
            </ul>
          )
        )}

        {/* COMMENTS */}
        {tab === 'comments' && (
          !canComments ? (
            <p className="text-sm text-stone-500">{profile.comments_visibility === 'friends' ? 'Comments are visible to friends only.' : 'Comments are private.'}</p>
          ) : commentItems.length === 0 ? (
            <p className="text-sm text-stone-500">No comments yet.</p>
          ) : (
            <ul className="space-y-2">
              {commentItems.map((c: any) => {
                const owner = commentOwner.get(c.post_id);
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

        {/* SHELF */}
        {tab === 'shelf' && (
          list.length === 0 ? (
            <p className="text-sm text-slate-500">No books on this shelf yet.</p>
          ) : (
            <div className="space-y-8">
              {grouped.map((group) => (
                <section key={group.status}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{STATUS_LABEL[group.status]} ({group.items.length})</h2>
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                    {group.items.map((e: any, i: number) => {
                      const src = coverUrl(e.books?.cover_id, 'M');
                      return (
                        <li key={i}>
                          <Link href={`/book/${e.book_id}`} className="group flex flex-col">
                            <div className="aspect-[2/3] w-full overflow-hidden rounded bg-slate-100 group-hover:opacity-90">
                              {src && <Image src={src} alt={e.books?.title ?? ''} width={200} height={300} className="h-full w-full object-cover" />}
                            </div>
                            <p className="mt-1 truncate text-sm font-medium">{e.books?.title}</p>
                            <p className="truncate text-xs text-slate-500">{e.books?.author}{e.rating ? ` · ${Number(e.rating).toFixed(1)}★` : ''}</p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
