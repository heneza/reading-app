import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { timeAgo } from '@/lib/time';
import Avatar from '@/components/Avatar';
import { reviewPost } from '@/app/actions/posts';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: notifsData } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  const notifs = notifsData ?? [];

  const actorIds = Array.from(new Set(notifs.map((n: any) => n.actor_id).filter(Boolean)));
  const actors = new Map<string, any>();
  if (actorIds.length) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', actorIds);
    (data ?? []).forEach((a: any) => actors.set(a.id, a));
  }

  const postIds = Array.from(new Set(notifs.map((n: any) => n.post_id).filter(Boolean)));
  const postsMap = new Map<string, any>();
  if (postIds.length) {
    const { data } = await supabase.from('posts').select('id, body_text, status').in('id', postIds);
    (data ?? []).forEach((p: any) => postsMap.set(p.id, p));
  }

  // Mark everything except actionable pending items as read.
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)
    .neq('type', 'article_pending');

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold">Notifications</h1>

      {notifs.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
          Nothing yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {notifs.map((n: any) => {
            const actor = actors.get(n.actor_id);
            const post = n.post_id ? postsMap.get(n.post_id) : null;

            if (n.type === 'article_pending') {
              const stillPending = post && post.status === 'pending';
              return (
                <li key={n.id} className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Avatar src={actor?.avatar_url} name={actor?.display_name ?? actor?.username} size={26} />
                    <span>
                      <Link href={`/u/${actor?.username}`} className="font-medium hover:text-brand hover:underline">
                        @{actor?.username}
                      </Link>{' '}
                      submitted an article for review
                    </span>
                    <span className="ml-auto flex-shrink-0 text-xs text-stone-400">{timeAgo(n.created_at)}</span>
                  </div>
                  {post && (
                    <p className="mt-2 text-sm text-stone-600">
                      {post.body_text.slice(0, 200)}
                      {post.body_text.length > 200 ? '…' : ''}
                    </p>
                  )}
                  {stillPending ? (
                    <div className="mt-2 flex gap-2">
                      <form action={reviewPost}>
                        <input type="hidden" name="postId" value={n.post_id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button className="rounded bg-brand px-3 py-1 text-sm font-medium text-white hover:bg-brand-dark">Approve</button>
                      </form>
                      <form action={reviewPost}>
                        <input type="hidden" name="postId" value={n.post_id} />
                        <input type="hidden" name="decision" value="reject" />
                        <button className="rounded border border-red-300 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50">Reject</button>
                      </form>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-stone-400">Already reviewed.</p>
                  )}
                </li>
              );
            }

            if (n.type === 'article_approved') {
              return (
                <li key={n.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                  <span className="text-stone-700">Your article was approved and is now public.</span>{' '}
                  <Link href="/articles" className="text-brand hover:underline">View articles</Link>
                  <span className="ml-2 text-xs text-stone-400">{timeAgo(n.created_at)}</span>
                </li>
              );
            }

            if (n.type === 'article_rejected') {
              return (
                <li key={n.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                  <span className="text-stone-700">Your article was not approved — try shortening or revising it, or post it as short-form.</span>
                  <span className="ml-2 text-xs text-stone-400">{timeAgo(n.created_at)}</span>
                </li>
              );
            }
            return null;
          })}
        </ul>
      )}
    </div>
  );
}
