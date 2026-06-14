import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/time';
import { deletePost } from '@/app/actions/posts';

export default function PostCard({
  post,
  author,
  canDelete = false,
  showAuthor = true,
}: {
  post: any;
  author?: any;
  canDelete?: boolean;
  showAuthor?: boolean;
}) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4">
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
          {post.status === 'rejected' && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">Needs shortening</span>
          )}
        </div>
        {canDelete && (
          <form action={deletePost}>
            <input type="hidden" name="id" value={post.id} />
            <button title="Delete post" className="flex-shrink-0 text-stone-300 hover:text-red-600">
              ×
            </button>
          </form>
        )}
      </div>

      <div className="post-body text-stone-800" dangerouslySetInnerHTML={{ __html: post.body_html }} />

      {post.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {post.tags.map((t: string) => (
            <Link key={t} href={`/search?type=posts&q=${encodeURIComponent(t)}`} className="text-xs text-brand hover:underline">
              #{t}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
