import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import { followUser, unfollowUser } from '@/app/actions/follows';

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
    .select('id, username, display_name, bio, website, twitter, instagram')
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

          {profile.bio && <p className="mt-2 text-slate-700">{profile.bio}</p>}

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
        </div>

        {/* Edit (own) or Follow/Unfollow (others) */}
        {isOwnProfile ? (
          <Link
            href="/settings"
            className="whitespace-nowrap rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Edit profile
          </Link>
        ) : user ? (
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
        ) : null}
      </div>

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
