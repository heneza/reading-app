import { sanitizePostHtml } from '@/lib/sanitize';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/time';
import PostEditToggle from '@/components/PostEditToggle';
import PendingButton from '@/components/PendingButton';
import { createClient } from '@/utils/supabase/server';
import {
  deletePost,
  reactToPost,
  repost,
  addPostComment,
  deletePostComment,
} from '@/app/actions/posts';

export default async function PostCard({
  post,
  author,
  canDelete = false,
  showAuthor = true,
  repostedBy = null,
}: {
  post: any;
  author?: any;
  canDelete?: boolean;
  showAuthor?: boolean;
  repostedBy?: string | null;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: rx }, { data: cm }, { data: rp }] = await Promise.all([
    supabase.from('post_reactions').select('user_id, type').eq('post_id', post.id),
    supabase.from('post_comments').select('id, user_id, body, created_at').eq('post_id', post.id).order('created_at', { ascending: true }),
    supabase.from('post_reposts').select('user_id').eq('post_id', post.id),
  ]);
  const reactions = rx ?? [];
  const comments = cm ?? [];
  const reposters = rp ?? [];
  const likes = reactions.filter((r: any) => r.type === 'like').length;
  const myReaction = user ? reactions.find((r: any) => r.user_id === user.id)?.type ?? null : null;
  const iReposted = user ? reposters.some((r: any) => r.user_id === user.id) : false;
  const withinHour = Date.now() - new Date(post.created_at).getTime() < 3600000;

  const nameById = new Map<string, any>();
  const cids = Array.from(new Set(comments.map((c: any) => c.user_id)));
  if (cids.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', cids);
    (profs ?? []).forEach((p: any) => nameById.set(p.id, p));
  }

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 ${active ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`;
  const heart = myReaction === 'like';
  const heartCls = `inline-flex h-9 min-w-12 items-center justify-center gap-1.5 rounded-full border px-3 text-sm transition ${
    heart
      ? 'border-brand bg-brand text-white'
      : 'border-slate-300 text-slate-600 hover:border-brand hover:bg-brand-soft hover:text-brand'
  }`;

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4">
      {repostedBy && (
        <p className="mb-1 text-xs text-stone-400">↻ reposted by @{repostedBy}</p>
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {showAuthor && author && (
            <>
              <Avatar src={author.avatar_url} name={author.display_name ?? author.username} size={26} />
              <Link href={`/u/${author.username}`} className="text-sm font-medium hover:text-brand hover:underline">
                @{author.username}
              </Link>
            </>
          )}
          <span className="text-xs text-stone-400">{timeAgo(post.created_at)}</span>
          {post.is_article && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">Article</span>
          )}
          {post.status === 'pending' && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Pending review</span>
          )}
        </div>
        {canDelete && (
          <form action={deletePost}>
            <input type="hidden" name="id" value={post.id} />
            <PendingButton title="Delete post" pendingLabel="..." className="flex-shrink-0 text-stone-300 hover:text-red-600">×</PendingButton>
          </form>
        )}
      </div>

      <div className="post-body text-stone-800" dangerouslySetInnerHTML={{ __html: sanitizePostHtml(post.body_html ?? '') }} />

      {post.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {post.tags.map((t: string) => (
            <Link key={t} href={`/search?type=posts&q=${encodeURIComponent(t)}`} className="text-xs text-brand hover:underline">
              #{t}
            </Link>
          ))}
        </div>
      )}

      {/* interaction bar */}
      <div className="mt-3 flex items-center gap-2 text-sm">
        <form action={reactToPost}>
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="type" value="like" />
          <PendingButton
            aria-label={heart ? 'Unlike post' : 'Like post'}
            title={heart ? 'Unlike post' : 'Like post'}
            pendingLabel="..."
            className={heartCls}
          >
            <span aria-hidden="true" className="text-base leading-none">{heart ? '♥' : '♡'}</span>
            <span>{likes}</span>
          </PendingButton>
        </form>
        <form action={repost} className="ml-auto">
          <input type="hidden" name="postId" value={post.id} />
          <PendingButton pendingLabel="..." className={pill(iReposted)} title="Repost to your profile">↻ {reposters.length}</PendingButton>
        </form>
      </div>

      {/* comments */}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-stone-500 hover:text-brand">
          {comments.length} comment{comments.length === 1 ? '' : 's'}
        </summary>
        <div className="mt-2 space-y-2 border-t border-stone-100 pt-2">
          {comments.map((c: any) => {
            const a = nameById.get(c.user_id);
            const mineC = c.user_id === user?.id;
            return (
              <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
                <p className="text-stone-700">
                  <Link href={`/u/${a?.username}`} className="font-medium hover:text-brand hover:underline">@{a?.username}</Link>{' '}
                  {c.body}{' '}
                  <span className="text-xs text-stone-400">· {timeAgo(c.created_at)}</span>
                </p>
                {mineC && (
                  <form action={deletePostComment}>
                    <input type="hidden" name="commentId" value={c.id} />
                    <PendingButton pendingLabel="..." className="text-stone-300 hover:text-red-600">×</PendingButton>
                  </form>
                )}
              </div>
            );
          })}
          {user && (
            <form action={addPostComment} className="flex gap-2">
              <input type="hidden" name="postId" value={post.id} />
              <input name="body" placeholder="Write a comment…" className="flex-1 rounded border border-stone-300 px-3 py-1 text-sm" />
              <PendingButton pendingLabel="Replying..." className="rounded bg-slate-700 px-3 py-1 text-sm text-white hover:opacity-90">Reply</PendingButton>
            </form>
          )}
        </div>
      </details>

      {canDelete && (
        <div className="mt-2 border-t border-stone-100 pt-2">
          <PostEditToggle
            postId={post.id}
            initialHtml={post.body_html}
            initialTags={post.tags ?? []}
            canEditBody={withinHour}
          />
        </div>
      )}
    </article>
  );
}
