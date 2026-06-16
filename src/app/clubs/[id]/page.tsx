import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import Avatar from '@/components/Avatar';
import PendingButton from '@/components/PendingButton';
import BookCoverImage from '@/components/BookCoverImage';
import { coverUrl } from '@/lib/openlibrary';
import { timeAgo } from '@/lib/time';
import {
  createClubPost,
  deleteClubPost,
  joinClub,
  leaveClub,
  moderateClubMember,
  updateClubNotificationPrefs,
  updateClubSettings,
} from '@/app/actions/clubs';
import { reportContent } from '@/app/actions/reports';

export const dynamic = 'force-dynamic';

type Club = {
  id: string;
  owner_id: string;
  name: string;
  topic: string;
  description: string | null;
  image_url: string | null;
  visibility: 'public' | 'private';
  current_book_id: string | null;
  recommendations_list_id: string | null;
};

type Member = {
  club_id: string;
  user_id: string;
  role: 'owner' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'blocked';
  notify_announcements?: boolean;
  notify_replies?: boolean;
  notify_current_book?: boolean;
  notify_mentions?: boolean;
  digest_general?: boolean;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ClubPost = {
  id: string;
  club_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  is_announcement: boolean;
  created_at: string;
};

function safeImage(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function memberName(profile?: Profile | null) {
  return profile?.display_name ?? (profile?.username ? `@${profile.username}` : 'reader');
}

function ReportForm({ targetId, next }: { targetId: string; next: string }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-stone-400 hover:text-brand">Report</summary>
      <form action={reportContent} className="mt-2 flex flex-wrap gap-2">
        <input type="hidden" name="targetType" value="club_post" />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="next" value={next} />
        <select name="reason" className="rounded border border-stone-300 px-2 py-1 text-xs">
          <option value="spam">Spam</option>
          <option value="harassment">Harassment</option>
          <option value="hate">Hate</option>
          <option value="spoiler">Spoiler</option>
          <option value="other">Other</option>
        </select>
        <input name="details" maxLength={600} placeholder="Optional note" className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-xs" />
        <PendingButton pendingLabel="Sending..." className="rounded bg-stone-700 px-2 py-1 text-xs text-white">
          Send
        </PendingButton>
      </form>
    </details>
  );
}

function PostForm({
  clubId,
  parentId,
  canAnnounce = false,
}: {
  clubId: string;
  parentId?: string;
  canAnnounce?: boolean;
}) {
  return (
    <form action={createClubPost} className="space-y-2">
      <input type="hidden" name="clubId" value={clubId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea
        name="body"
        required
        maxLength={2000}
        rows={parentId ? 2 : 3}
        placeholder={parentId ? 'Reply...' : 'Start a discussion...'}
        className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        {canAnnounce && !parentId ? (
          <label className="flex items-center gap-2 text-xs text-stone-500">
            <input type="checkbox" name="isAnnouncement" className="h-4 w-4" />
            Announcement
          </label>
        ) : (
          <span />
        )}
        <PendingButton pendingLabel="Posting..." className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">
          Post
        </PendingButton>
      </div>
    </form>
  );
}

export default async function ClubPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clubRow } = await supabase
    .from('clubs')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!clubRow) notFound();
  const club = clubRow as Club;
  const clubUrl = `/clubs/${club.id}`;

  const [{ data: myMember }, { data: myProfile }] = await Promise.all([
    user
      ? supabase
          .from('club_members')
          .select('*')
          .eq('club_id', club.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    user ? supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null as any }),
  ]);
  const membership = myMember as Member | null;
  const isActive = membership?.status === 'active';
  const canModerate =
    !!myProfile?.is_admin ||
    (membership?.status === 'active' && ['owner', 'moderator'].includes(membership.role));
  const canViewDiscussion = club.visibility === 'public' || isActive || canModerate;

  const [
    { data: memberRows },
    { data: postRows },
    { data: currentBookRows },
    { data: recItems },
  ] = await Promise.all([
    supabase
      .from('club_members')
      .select('*')
      .eq('club_id', club.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('club_posts')
      .select('*')
      .eq('club_id', club.id)
      .order('created_at', { ascending: true })
      .limit(160),
    club.current_book_id
      ? supabase
          .from('books')
          .select('id, title, author, cover_id')
          .eq('id', club.current_book_id)
      : Promise.resolve({ data: [] as any[] }),
    club.recommendations_list_id
      ? supabase
          .from('list_items')
          .select('book_id, position, books ( title, author, cover_id )')
          .eq('list_id', club.recommendations_list_id)
          .order('position', { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const members = (memberRows ?? []) as Member[];
  const posts = (postRows ?? []) as ClubPost[];
  const activeMembers = members.filter((member) => member.status === 'active');
  const pendingMembers = members.filter((member) => member.status === 'pending');
  const profileIds = Array.from(new Set([...members.map((m) => m.user_id), ...posts.map((p) => p.user_id)]));
  const profiles = new Map<string, Profile>();
  if (profileIds.length) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', profileIds);
    (data ?? []).forEach((profile: Profile) => profiles.set(profile.id, profile));
  }

  const currentBook = currentBookRows?.[0] as any | undefined;
  const roots = posts.filter((post) => !post.parent_id);
  const replies = new Map<string, ClubPost[]>();
  posts
    .filter((post) => post.parent_id)
    .forEach((post) => {
      const arr = replies.get(post.parent_id as string) ?? [];
      arr.push(post);
      replies.set(post.parent_id as string, arr);
    });

  const image = safeImage(club.image_url);

  return (
    <div className="relative left-1/2 w-[min(100vw-2rem,1180px)] -translate-x-1/2 space-y-6">
      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div
          className="h-44 bg-brand-soft bg-cover bg-center"
          style={image ? { backgroundImage: `linear-gradient(rgba(20,16,15,.12), rgba(20,16,15,.32)), url(${image})` } : undefined}
        />
        <div className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{club.name}</h1>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">{club.visibility}</span>
            </div>
            <p className="text-sm font-medium text-stone-600">{club.topic}</p>
            {club.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{club.description}</p>}
          </div>

          {user ? (
            isActive ? (
              membership?.role === 'owner' ? (
                <span className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-500">Owner</span>
              ) : (
                <form action={leaveClub}>
                  <input type="hidden" name="clubId" value={club.id} />
                  <PendingButton pendingLabel="Leaving..." className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:border-brand hover:text-brand">
                    Leave
                  </PendingButton>
                </form>
              )
            ) : membership?.status === 'pending' ? (
              <span className="rounded-full border border-stone-200 px-4 py-2 text-sm text-stone-500">Request pending</span>
            ) : (
              <form action={joinClub}>
                <input type="hidden" name="clubId" value={club.id} />
                <PendingButton pendingLabel="Joining..." className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                  {club.visibility === 'private' ? 'Request to join' : 'Join'}
                </PendingButton>
              </form>
            )
          ) : (
            <Link href={`/login?next=${encodeURIComponent(clubUrl)}`} className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Join
            </Link>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <main className="space-y-6">
          {(currentBook || (recItems ?? []).length > 0) && (
            <section className="grid gap-4 md:grid-cols-2">
              {currentBook && (
                <Link href={`/book/${currentBook.id}`} className="rounded-lg border border-stone-200 bg-white p-4 hover:border-brand">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Current read</p>
                  <div className="mt-3 flex gap-3">
                    <div className="book-cover-fallback h-24 w-16 flex-shrink-0 overflow-hidden rounded">
                      <BookCoverImage src={coverUrl(currentBook.cover_id, 'M')} alt="" width={80} height={120} className="relative z-10 h-full w-full object-cover" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{currentBook.title}</h2>
                      <p className="mt-1 text-sm text-stone-500">{currentBook.author}</p>
                    </div>
                  </div>
                </Link>
              )}

              {(recItems ?? []).length > 0 && (
                <section className="rounded-lg border border-stone-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Recommendations</p>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {(recItems ?? []).slice(0, 8).map((item: any) => {
                      const src = coverUrl(item.books?.cover_id, 'S');
                      return (
                        <Link key={item.book_id} href={`/book/${item.book_id}`} title={item.books?.title ?? ''} className="book-cover-fallback aspect-[2/3] overflow-hidden rounded">
                          <BookCoverImage src={src} alt="" width={56} height={84} className="relative z-10 h-full w-full object-cover" />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}
            </section>
          )}

          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Discussion</h2>
            {isActive ? (
              <div className="mt-3">
                <PostForm clubId={club.id} canAnnounce={canModerate} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-500">Join to post.</p>
            )}

            <div className="mt-5 space-y-4">
              {!canViewDiscussion ? (
                <p className="text-sm text-stone-500">This club&apos;s discussion is private. Request to join to view posts.</p>
              ) : roots.length === 0 ? (
                <p className="text-sm text-stone-500">No discussion yet.</p>
              ) : (
                roots.map((post) => {
                  const author = profiles.get(post.user_id);
                  const postReplies = replies.get(post.id) ?? [];
                  const canDelete = canModerate || post.user_id === user?.id;
                  return (
                    <article key={post.id} id={`post-${post.id}`} className="rounded-lg border border-stone-200 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Avatar src={author?.avatar_url} name={memberName(author)} size={28} />
                        <Link href={author?.username ? `/u/${author.username}` : '#'} className="text-sm font-medium hover:text-brand hover:underline">
                          {author?.username ? `@${author.username}` : 'reader'}
                        </Link>
                        <span className="text-xs text-stone-400">{timeAgo(post.created_at)}</span>
                        {post.is_announcement && (
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">Announcement</span>
                        )}
                        {canDelete && (
                          <form action={deleteClubPost} className="ml-auto">
                            <input type="hidden" name="clubId" value={club.id} />
                            <input type="hidden" name="postId" value={post.id} />
                            <PendingButton pendingLabel="..." className="text-stone-300 hover:text-red-600">x</PendingButton>
                          </form>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">{post.body}</p>
                      {user && <ReportForm targetId={post.id} next={clubUrl} />}

                      {postReplies.length > 0 && (
                        <div className="mt-3 space-y-2 border-l border-stone-200 pl-3">
                          {postReplies.map((reply) => {
                            const replyAuthor = profiles.get(reply.user_id);
                            const canDeleteReply = canModerate || reply.user_id === user?.id;
                            return (
                              <div key={reply.id} id={`post-${reply.id}`} className="text-sm">
                                <div className="flex items-center gap-2">
                                  <Avatar src={replyAuthor?.avatar_url} name={memberName(replyAuthor)} size={22} />
                                  <Link href={replyAuthor?.username ? `/u/${replyAuthor.username}` : '#'} className="font-medium hover:text-brand hover:underline">
                                    {replyAuthor?.username ? `@${replyAuthor.username}` : 'reader'}
                                  </Link>
                                  <span className="text-xs text-stone-400">{timeAgo(reply.created_at)}</span>
                                  {canDeleteReply && (
                                    <form action={deleteClubPost} className="ml-auto">
                                      <input type="hidden" name="clubId" value={club.id} />
                                      <input type="hidden" name="postId" value={reply.id} />
                                      <PendingButton pendingLabel="..." className="text-stone-300 hover:text-red-600">x</PendingButton>
                                    </form>
                                  )}
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-stone-600">{reply.body}</p>
                                {user && <ReportForm targetId={reply.id} next={clubUrl} />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {isActive && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs text-brand">Reply</summary>
                          <div className="mt-2">
                            <PostForm clubId={club.id} parentId={post.id} />
                          </div>
                        </details>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Moderators</h2>
            <ul className="mt-3 space-y-2">
              {activeMembers
                .filter((member) => member.role === 'owner' || member.role === 'moderator')
                .map((member) => {
                  const profile = profiles.get(member.user_id);
                  return (
                    <li key={member.user_id} className="flex items-center gap-2">
                      <Avatar src={profile?.avatar_url} name={memberName(profile)} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{profile?.username ? `@${profile.username}` : 'reader'}</p>
                        <p className="text-xs text-stone-400">{member.role}</p>
                      </div>
                    </li>
                  );
                })}
            </ul>
            <p className="mt-3 text-xs text-stone-500">{activeMembers.length} active members</p>
          </section>

          {isActive && membership && (
            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Notifications</h2>
              <form action={updateClubNotificationPrefs} className="mt-3 space-y-2 text-sm text-stone-600">
                <input type="hidden" name="clubId" value={club.id} />
                <label className="flex items-center gap-2"><input type="checkbox" name="notifyAnnouncements" defaultChecked={membership.notify_announcements !== false} /> Announcements</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="notifyReplies" defaultChecked={membership.notify_replies !== false} /> Replies to you</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="notifyCurrentBook" defaultChecked={membership.notify_current_book !== false} /> Book pick</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="notifyMentions" defaultChecked={membership.notify_mentions !== false} /> Mentions</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="digestGeneral" defaultChecked={membership.digest_general === true} /> Digest</label>
                <PendingButton pendingLabel="Saving..." className="rounded-full border border-stone-300 px-3 py-1 text-xs hover:border-brand hover:text-brand">
                  Save
                </PendingButton>
              </form>
            </section>
          )}

          {canModerate && (
            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Club settings</h2>
              <form action={updateClubSettings} className="mt-3 space-y-2">
                <input type="hidden" name="clubId" value={club.id} />
                <input name="name" defaultValue={club.name} maxLength={80} className="w-full rounded border border-stone-300 px-3 py-2 text-sm" />
                <input name="topic" defaultValue={club.topic} maxLength={60} className="w-full rounded border border-stone-300 px-3 py-2 text-sm" />
                <select name="visibility" defaultValue={club.visibility} className="w-full rounded border border-stone-300 px-3 py-2 text-sm">
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <input name="imageUrl" defaultValue={club.image_url ?? ''} placeholder="Image URL" className="w-full rounded border border-stone-300 px-3 py-2 text-sm" />
                <input name="currentBookId" defaultValue={club.current_book_id ?? ''} placeholder="Current book ID" className="w-full rounded border border-stone-300 px-3 py-2 text-sm" />
                <input name="recommendationsListId" defaultValue={club.recommendations_list_id ?? ''} placeholder="Recommendations list ID" className="w-full rounded border border-stone-300 px-3 py-2 text-sm" />
                <textarea name="description" defaultValue={club.description ?? ''} maxLength={600} rows={3} className="w-full rounded border border-stone-300 px-3 py-2 text-sm" />
                <PendingButton pendingLabel="Saving..." className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">
                  Save
                </PendingButton>
              </form>
            </section>
          )}

          {canModerate && pendingMembers.length > 0 && (
            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Requests</h2>
              <ul className="mt-3 space-y-2">
                {pendingMembers.map((member) => {
                  const profile = profiles.get(member.user_id);
                  return (
                    <li key={member.user_id} className="flex items-center gap-2">
                      <Avatar src={profile?.avatar_url} name={memberName(profile)} size={26} />
                      <span className="min-w-0 flex-1 truncate text-sm">{profile?.username ? `@${profile.username}` : 'reader'}</span>
                      <form action={moderateClubMember}>
                        <input type="hidden" name="clubId" value={club.id} />
                        <input type="hidden" name="memberId" value={member.user_id} />
                        <input type="hidden" name="action" value="approve" />
                        <PendingButton pendingLabel="..." className="text-xs text-brand hover:underline">Approve</PendingButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {canModerate && activeMembers.length > 1 && (
            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Members</h2>
              <ul className="mt-3 space-y-2">
                {activeMembers
                  .filter((member) => member.role !== 'owner')
                  .slice(0, 12)
                  .map((member) => {
                    const profile = profiles.get(member.user_id);
                    return (
                      <li key={member.user_id} className="flex items-center gap-2">
                        <Avatar src={profile?.avatar_url} name={memberName(profile)} size={24} />
                        <span className="min-w-0 flex-1 truncate text-xs">{profile?.username ? `@${profile.username}` : 'reader'}</span>
                        <form action={moderateClubMember}>
                          <input type="hidden" name="clubId" value={club.id} />
                          <input type="hidden" name="memberId" value={member.user_id} />
                          <input type="hidden" name="action" value={member.role === 'moderator' ? 'member' : 'mod'} />
                          <PendingButton pendingLabel="..." className="text-xs text-brand hover:underline">
                            {member.role === 'moderator' ? 'Member' : 'Mod'}
                          </PendingButton>
                        </form>
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
