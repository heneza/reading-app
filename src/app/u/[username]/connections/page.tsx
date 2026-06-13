import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { followUser, unfollowUser } from '@/app/actions/follows';

type ConnType = 'followers' | 'following' | 'friends';
type Person = { id: string; username: string; display_name: string | null };

// Fetch profile rows for a set of ids.
async function profilesByIds(
  supabase: ReturnType<typeof createClient>,
  ids: string[]
): Promise<Person[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', ids);
  return (data ?? []) as Person[];
}

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { type?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const type: ConnType = (['followers', 'following', 'friends'].includes(
    searchParams.type ?? ''
  )
    ? searchParams.type
    : 'followers') as ConnType;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('username', params.username)
    .maybeSingle();
  if (!profile) notFound();

  // Who follows this profile, and who this profile follows.
  const { data: followerRows } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('followee_id', profile.id);
  const { data: followingRows } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', profile.id);

  const followerIds = (followerRows ?? []).map((r: any) => r.follower_id);
  const followingIds = (followingRows ?? []).map((r: any) => r.followee_id);
  const followingSet = new Set(followingIds);
  const friendIds = followerIds.filter((id: string) => followingSet.has(id));

  let people: Person[] = [];
  if (type === 'followers') people = await profilesByIds(supabase, followerIds);
  else if (type === 'following') people = await profilesByIds(supabase, followingIds);
  else people = await profilesByIds(supabase, friendIds);

  // The viewer's own following set, to label each button correctly.
  let myFollowing = new Set<string>();
  if (user) {
    const { data } = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', user.id);
    myFollowing = new Set((data ?? []).map((r: any) => r.followee_id));
  }

  const returnTo = `/u/${profile.username}/connections?type=${type}`;
  const tab = (t: ConnType, label: string, n: number) => (
    <Link
      href={`/u/${profile.username}/connections?type=${t}`}
      className={`rounded-full px-3 py-1 text-sm ${
        type === t ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label} ({n})
    </Link>
  );

  return (
    <div>
      <Link
        href={`/u/${profile.username}`}
        className="text-sm text-brand hover:underline"
      >
        ← {profile.display_name ?? profile.username}
      </Link>

      <div className="mb-5 mt-2 flex gap-2">
        {tab('followers', 'Followers', followerIds.length)}
        {tab('following', 'Following', followingIds.length)}
        {tab('friends', 'Friends', friendIds.length)}
      </div>

      {people.length === 0 ? (
        <p className="mt-10 text-center text-slate-400">No one here yet.</p>
      ) : (
        <ul className="space-y-2">
          {people.map((p) => {
            const isMe = p.id === user?.id;
            const iFollow = myFollowing.has(p.id);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between rounded border border-slate-200 bg-white p-3"
              >
                <Link href={`/u/${p.username}`} className="min-w-0">
                  <span className="font-medium hover:text-brand">
                    {p.display_name ?? p.username}
                  </span>
                  <span className="ml-2 text-sm text-slate-500">
                    @{p.username}
                  </span>
                </Link>

                {user && !isMe && (
                  <form action={iFollow ? unfollowUser : followUser}>
                    <input type="hidden" name="followeeId" value={p.id} />
                    <input type="hidden" name="username" value={p.username} />
                    <input type="hidden" name="redirectTo" value={returnTo} />
                    <button
                      className={
                        iFollow
                          ? 'rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100'
                          : 'rounded-full bg-brand px-3 py-1 text-sm text-white hover:opacity-90'
                      }
                    >
                      {iFollow ? 'Following' : 'Follow'}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
