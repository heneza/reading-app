import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import { followUser, unfollowUser } from '@/app/actions/follows';
import { genreName } from '@/lib/genres';
import Avatar from '@/components/Avatar';

// Turn @mentions in free text into links to those users' profiles.
// Only usernames that actually exist (in `valid`) become links.
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
        <Link key={key++} href={`/u/${uname}`} className="font-medium text-brand hover:underline">
          @{uname}
        </Link>
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

// Always render fresh (no caching) so data and login state are current.
export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, website, twitter, instagram, avatar_url')
    .eq('username', params.username)
    .maybeSingle();
  if (!profile) notFound();

  // Shelf
  const { data: entries } = await supabase
    .from('reading_entries')
    .select('status, rating, book_id, books ( title, author, cover_id )')
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false });
  const list = entries ?? [];

  // Favourite genres (shown as chips on the profile).
  const { data: genreRows } = await supabase
    .from('profile_genres')
    .select('genre')
    .eq('user_id', profile.id);
  const favGenres = (genreRows ?? []).map((r: any) => r.genre);

  // Resolve @mentions in the bio to real users (only those become links).
  const mentioned = Array.from(
    new Set(
      (profile.bio?.match(/@([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)/g) ?? []).map(
        (t: string) => t.slice(1)
      )
    )
  );
  let validMentions = new Set<string>();
  if (mentioned.length) {
    const { data: mp } = await supabase
      .from('profiles')
      .select('username')
      .in('username', mentioned);
    validMentions = new Set((mp ?? []).map((r: any) => String(r.username).toLowerCase()));
  }


  // Favourite books (Top 4, like Letterboxd).
  const { data: favRows } = await supabase
    .from('favorite_books')
    .select('position, book_id, books ( title, author, cover_id )')
    .eq('user_id', profile.id)
    .order('position');
  const favs = favRows ?? [];

  // Most liked reviews by this user.
  const { data: myReviews } = await supabase
    .from('reviews')
    .select('id, body, book_id, books ( title )')
    .eq('user_id', profile.id);
  const reviewIds = (myReviews ?? []).map((r: any) => r.id);
  const likeCount = new Map<string, number>();
  if (reviewIds.length) {
    const { data: rx } = await supabase
      .from('review_reactions')
      .select('review_id')
      .eq('type', 'like')
      .in('review_id', reviewIds);
    (rx ?? []).forEach((r: any) =>
      likeCount.set(r.review_id, (likeCount.get(r.review_id) ?? 0) + 1)
    );
  }
  const topReviews = (myReviews ?? [])
    .map((r: any) => ({ ...r, likes: likeCount.get(r.id) ?? 0 }))
    .filter((r: any) => r.likes > 0)
    .sort((a: any, b: any) => b.likes - a.likes)
    .slice(0, 4);

  // Follow graph: who follows them, who they follow (used for counts + friends)
  const { data: followerRows } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('followee_id', profile.id);
  const { data: followingRows } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', profile.id);
  const followerIds = (followerRows ?? []).map((r: any) => r.follower_id);
  const followingSet = new Set((followingRows ?? []).map((r: any) => r.followee_id));
  const friendCount = followerIds.filter((id: string) => followingSet.has(id)).length;

  const isOwnProfile = user?.id === profile.id;
  const isFollowing = !!user && !isOwnProfile && followerIds.includes(user.id);

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: list.filter((e: any) => e.status === status),
  })).filter((g) => g.items.length > 0);

  const connHref = (t: string) =>
    `/u/${profile.username}/connections?type=${t}`;

  return (
    <div>
      {/* --- Profile header --- */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar
            src={profile.avatar_url}
            name={profile.display_name ?? profile.username}
            size={72}
          />
          <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            {profile.display_name ?? profile.username}
          </h1>
          <p className="text-sm text-slate-500">@{profile.username}</p>

          {/* Clickable counts */}
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-500">
            <Link href={connHref('followers')} className="hover:text-brand">
              <span className="font-medium text-slate-700">
                {followerIds.length}
              </span>{' '}
              followers
            </Link>
            <Link href={connHref('following')} className="hover:text-brand">
              <span className="font-medium text-slate-700">
                {followingSet.size}
              </span>{' '}
              following
            </Link>
            <Link href={connHref('friends')} className="hover:text-brand">
              <span className="font-medium text-slate-700">{friendCount}</span>{' '}
              friends
            </Link>
            <span>
              <span className="font-medium text-slate-700">{list.length}</span>{' '}
              book{list.length === 1 ? '' : 's'}
            </span>
          </p>

          {profile.bio && (
            <p className="mt-2 whitespace-pre-wrap text-slate-700">
              {linkifyMentions(profile.bio, validMentions)}
            </p>
          )}

          {/* Social links */}
          {(profile.website || profile.instagram || profile.twitter) && (
            <p className="mt-2 flex flex-wrap gap-3 text-sm">
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  Website
                </a>
              )}
              {profile.instagram && (
                <a
                  href={`https://instagram.com/${profile.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  Instagram
                </a>
              )}
              {profile.twitter && (
                <a
                  href={`https://x.com/${profile.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  X
                </a>
              )}
            </p>
          )}

          {favGenres.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {favGenres.map((slug: string) => (
                <span
                  key={slug}
                  className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand"
                >
                  {genreName(slug)}
                </span>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Edit (own) or Follow/Unfollow (others) */}
        {isOwnProfile ? (
          <Link
            href="/settings/profile"
            className="whitespace-nowrap rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Edit profile
          </Link>
        ) : user ? (
          <div className="flex flex-shrink-0 items-center gap-2">
            <Link
              href={`/messages/${profile.username}`}
              className="whitespace-nowrap rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Message
            </Link>
            <form action={isFollowing ? unfollowUser : followUser}>
              <input type="hidden" name="followeeId" value={profile.id} />
              <input type="hidden" name="username" value={profile.username} />
              <button
                className={
                  isFollowing
                    ? 'rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100'
                    : 'rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90'
                }
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {/* --- Favourites (Top 4) --- */}
      {favs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Favourites
          </h2>
          <ul className="grid grid-cols-4 gap-3 sm:max-w-md">
            {favs.map((f: any) => {
              const src = coverUrl(f.books?.cover_id, 'M');
              return (
                <li key={f.position}>
                  <Link href={`/book/${f.book_id}`} className="group block">
                    <div className="aspect-[2/3] w-full overflow-hidden rounded bg-slate-100 group-hover:opacity-90">
                      {src && (
                        <Image
                          src={src}
                          alt={f.books?.title ?? ''}
                          width={200}
                          height={300}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* --- Most liked reviews --- */}
      {topReviews.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Most liked reviews
          </h2>
          <ul className="space-y-3">
            {topReviews.map((r: any) => (
              <li key={r.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Link
                    href={`/book/${r.book_id}`}
                    className="text-sm font-semibold hover:text-brand hover:underline"
                  >
                    {r.books?.title}
                  </Link>
                  <span className="flex-shrink-0 text-xs text-stone-500">♥ {r.likes}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-stone-700">
                  {r.body.length > 240 ? r.body.slice(0, 240) + '…' : r.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- Shelf --- */}
      {list.length === 0 ? (
        <p className="mt-6 text-slate-500">No books on this shelf yet.</p>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.map((group) => (
            <section key={group.status}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                {STATUS_LABEL[group.status]} ({group.items.length})
              </h2>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {group.items.map((e: any, i: number) => {
                  const src = coverUrl(e.books?.cover_id, 'M');
                  return (
                    <li key={i}>
                      <Link href={`/book/${e.book_id}`} className="group flex flex-col">
                        <div className="aspect-[2/3] w-full overflow-hidden rounded bg-slate-100 group-hover:opacity-90">
                          {src && (
                            <Image
                              src={src}
                              alt={e.books?.title ?? ''}
                              width={200}
                              height={300}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">
                          {e.books?.title}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {e.books?.author}
                          {e.rating ? ` · ${Number(e.rating).toFixed(1)}★` : ''}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
