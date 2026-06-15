import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { htmlToText } from '@/lib/sanitize';
import { timeAgo } from '@/lib/time';

export const dynamic = 'force-dynamic';

const TABS = ['overview', 'quotes', 'posts', 'reviews', 'likes', 'replies'] as const;
type ActivityTab = (typeof TABS)[number];

const TAB_LABEL: Record<ActivityTab, string> = {
  overview: 'Overview',
  quotes: 'Quotes',
  posts: 'Posts',
  reviews: 'Reviews',
  likes: 'Likes',
  replies: 'Replies',
};

function activeTab(value?: string): ActivityTab {
  return TABS.includes(value as ActivityTab) ? (value as ActivityTab) : 'overview';
}

function emptyText(tab: ActivityTab) {
  if (tab === 'quotes') return 'No quotes saved yet.';
  if (tab === 'posts') return 'No posts yet.';
  if (tab === 'reviews') return 'No reviews yet.';
  if (tab === 'likes') return 'No likes yet.';
  if (tab === 'replies') return 'No replies yet.';
  return 'No activity yet.';
}

function metric(label: string, value: number, href: string) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-stone-200 bg-white p-4 transition hover:border-brand hover:shadow-card"
    >
      <span className="block text-2xl font-bold text-stone-900">{value}</span>
      <span className="mt-1 block text-sm text-stone-500">{label}</span>
    </Link>
  );
}

function quoteCard(quote: any) {
  return (
    <li key={quote.id} className="rounded-lg border border-stone-200 bg-white p-4">
      <blockquote className="whitespace-pre-wrap text-base leading-relaxed text-stone-800">
        &ldquo;{quote.body}&rdquo;
      </blockquote>
      {(quote.source_title || quote.source_author) && (
        <p className="mt-2 text-sm text-stone-500">
          {quote.source_title && <span className="font-medium text-stone-700">{quote.source_title}</span>}
          {quote.source_title && quote.source_author && ' - '}
          {quote.source_author}
        </p>
      )}
      {quote.note && <p className="mt-3 rounded bg-stone-50 p-2 text-sm text-stone-600">{quote.note}</p>}
      <p className="mt-3 text-xs text-stone-400">
        {quote.visibility === 'public' ? 'Public' : 'Private'} - {timeAgo(quote.created_at)}
      </p>
    </li>
  );
}

function postCard(post: any, author?: any) {
  const preview = String(post.body_text || htmlToText(post.body_html ?? '') || 'Untitled post').trim();
  return (
    <li key={post.id} className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-stone-400">
        {author?.username && (
          <Link href={`/u/${author.username}`} className="font-medium text-stone-600 hover:text-brand hover:underline">
            @{author.username}
          </Link>
        )}
        <span>{timeAgo(post.created_at)}</span>
        {post.is_article && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">Article</span>
        )}
        {post.status !== 'published' && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            {post.status}
          </span>
        )}
      </div>
      <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{preview}</p>
      {post.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((tag: string) => (
            <Link key={tag} href={`/search?filter=posts&q=${encodeURIComponent(tag)}`} className="text-xs text-brand hover:underline">
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}

function reviewCard(review: any) {
  return (
    <li key={review.id} className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <Link href={`/book/${review.book_id}`} className="font-medium text-stone-800 hover:text-brand hover:underline">
          {review.books?.title ?? 'Book'}
        </Link>
        <span className="flex-shrink-0 text-xs text-stone-400">{timeAgo(review.created_at)}</span>
      </div>
      <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-stone-600">{review.body}</p>
    </li>
  );
}

function likeCard(item: any) {
  if (item.kind === 'post') {
    const preview = String(item.post?.body_text || htmlToText(item.post?.body_html ?? '') || 'a post').trim();
    return (
      <li key={`post-${item.id}`} className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Liked post</p>
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{preview}</p>
        <p className="mt-3 text-xs text-stone-400">{timeAgo(item.created_at)}</p>
      </li>
    );
  }

  if (item.kind === 'review') {
    return (
      <li key={`review-${item.id}`} className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Liked review</p>
        <Link href={`/book/${item.review?.book_id}`} className="mt-2 block font-medium hover:text-brand hover:underline">
          {item.review?.books?.title ?? 'Book'}
        </Link>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">{item.review?.body}</p>
        <p className="mt-3 text-xs text-stone-400">{timeAgo(item.created_at)}</p>
      </li>
    );
  }

  return (
    <li key={`list-${item.id}`} className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Liked list</p>
      <Link href={`/list/${item.list?.id}`} className="mt-2 block font-medium hover:text-brand hover:underline">
        {item.list?.title ?? 'List'}
      </Link>
      {item.list?.description && <p className="mt-1 text-sm text-stone-600">{item.list.description}</p>}
      <p className="mt-3 text-xs text-stone-400">{timeAgo(item.created_at)}</p>
    </li>
  );
}

function replyCard(item: any) {
  return (
    <li key={`${item.kind}-${item.id}`} className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {item.kind === 'post' ? 'Post reply' : 'Review reply'}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{item.body}</p>
      {item.href && (
        <Link href={item.href} className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
          {item.context}
        </Link>
      )}
      <p className="mt-3 text-xs text-stone-400">{timeAgo(item.created_at)}</p>
    </li>
  );
}

async function loadPostAuthors(supabase: ReturnType<typeof createClient>, posts: any[]) {
  const authorIds = Array.from(new Set(posts.map((post: any) => post.user_id).filter(Boolean)));
  const authors = new Map<string, any>();
  if (authorIds.length) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', authorIds);
    (data ?? []).forEach((author: any) => authors.set(author.id, author));
  }
  return authors;
}

async function loadLikes(supabase: ReturnType<typeof createClient>, userId: string, limit: number) {
  const [postLikesRes, reviewLikesRes, listLikesRes] = await Promise.all([
    supabase
      .from('post_reactions')
      .select('post_id, created_at')
      .eq('user_id', userId)
      .eq('type', 'like')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('review_reactions')
      .select('review_id, created_at')
      .eq('user_id', userId)
      .eq('type', 'like')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('list_likes')
      .select('list_id, created_at, lists ( id, title, description )')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const postIds = (postLikesRes.data ?? []).map((row: any) => row.post_id);
  const reviewIds = (reviewLikesRes.data ?? []).map((row: any) => row.review_id);

  const [postsRes, reviewsRes] = await Promise.all([
    postIds.length
      ? supabase
          .from('posts')
          .select('id, user_id, body_html, body_text, is_article, status, tags, created_at')
          .in('id', postIds)
      : Promise.resolve({ data: [] as any[] }),
    reviewIds.length
      ? supabase
          .from('reviews')
          .select('id, body, book_id, created_at, books ( title )')
          .in('id', reviewIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const posts = new Map((postsRes.data ?? []).map((post: any) => [post.id, post]));
  const reviews = new Map((reviewsRes.data ?? []).map((review: any) => [review.id, review]));

  return [
    ...(postLikesRes.data ?? []).map((row: any) => ({
      id: row.post_id,
      kind: 'post',
      created_at: row.created_at,
      post: posts.get(row.post_id),
    })),
    ...(reviewLikesRes.data ?? []).map((row: any) => ({
      id: row.review_id,
      kind: 'review',
      created_at: row.created_at,
      review: reviews.get(row.review_id),
    })),
    ...(listLikesRes.data ?? []).map((row: any) => ({
      id: row.list_id,
      kind: 'list',
      created_at: row.created_at,
      list: row.lists,
    })),
  ]
    .filter((item: any) => item.post || item.review || item.list)
    .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

async function loadReplies(supabase: ReturnType<typeof createClient>, userId: string, limit: number) {
  const [postRepliesRes, reviewRepliesRes] = await Promise.all([
    supabase
      .from('post_comments')
      .select('id, post_id, body, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('review_comments')
      .select('id, review_id, body, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const postIds = Array.from(new Set((postRepliesRes.data ?? []).map((row: any) => row.post_id)));
  const reviewIds = Array.from(new Set((reviewRepliesRes.data ?? []).map((row: any) => row.review_id)));

  const [postsRes, reviewsRes] = await Promise.all([
    postIds.length ? supabase.from('posts').select('id, user_id, body_text').in('id', postIds) : Promise.resolve({ data: [] as any[] }),
    reviewIds.length
      ? supabase.from('reviews').select('id, book_id, books ( title )').in('id', reviewIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const posts = new Map((postsRes.data ?? []).map((post: any) => [post.id, post]));
  const postAuthors = await loadPostAuthors(supabase, postsRes.data ?? []);
  const reviews = new Map((reviewsRes.data ?? []).map((review: any) => [review.id, review]));

  return [
    ...(postRepliesRes.data ?? []).map((row: any) => {
      const post = posts.get(row.post_id);
      const author = post ? postAuthors.get(post.user_id) : null;
      return {
        ...row,
        kind: 'post',
        context: author?.username ? `On @${author.username}'s post` : 'On a post',
        href: author?.username ? `/u/${author.username}?tab=posts` : null,
      };
    }),
    ...(reviewRepliesRes.data ?? []).map((row: any) => {
      const review = reviews.get(row.review_id);
      return {
        ...row,
        kind: 'review',
        context: review?.books?.title ? `On ${review.books.title}` : 'On a review',
        href: review?.book_id ? `/book/${review.book_id}` : null,
      };
    }),
  ]
    .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tab = activeTab(searchParams.tab);

  const [
    profileRes,
    quoteCountRes,
    postCountRes,
    reviewCountRes,
    postLikeCountRes,
    reviewLikeCountRes,
    listLikeCountRes,
    postReplyCountRes,
    reviewReplyCountRes,
  ] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle(),
    supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('post_reactions').select('post_id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'like'),
    supabase.from('review_reactions').select('review_id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'like'),
    supabase.from('list_likes').select('list_id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('post_comments').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('review_comments').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const username = profileRes.data?.username ?? 'you';
  const counts = {
    quotes: quoteCountRes.count ?? 0,
    posts: postCountRes.count ?? 0,
    reviews: reviewCountRes.count ?? 0,
    likes: (postLikeCountRes.count ?? 0) + (reviewLikeCountRes.count ?? 0) + (listLikeCountRes.count ?? 0),
    replies: (postReplyCountRes.count ?? 0) + (reviewReplyCountRes.count ?? 0),
  };

  const limit = tab === 'overview' ? 5 : 30;
  let quotes: any[] = [];
  let posts: any[] = [];
  let authors = new Map<string, any>();
  let reviews: any[] = [];
  let likes: any[] = [];
  let replies: any[] = [];

  if (tab === 'overview' || tab === 'quotes') {
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    quotes = data ?? [];
  }

  if (tab === 'overview' || tab === 'posts') {
    const { data } = await supabase
      .from('posts')
      .select('id, user_id, body_html, body_text, is_article, status, tags, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    posts = data ?? [];
    authors = await loadPostAuthors(supabase, posts);
  }

  if (tab === 'overview' || tab === 'reviews') {
    const { data } = await supabase
      .from('reviews')
      .select('id, body, book_id, created_at, books ( title )')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    reviews = data ?? [];
  }

  if (tab === 'overview' || tab === 'likes') {
    likes = await loadLikes(supabase, user.id, limit);
  }

  if (tab === 'overview' || tab === 'replies') {
    replies = await loadReplies(supabase, user.id, limit);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/settings" className="text-sm text-stone-400 hover:text-brand">
            Back to settings
          </Link>
          <h1 className="mt-2 text-2xl font-bold">My activity</h1>
          <p className="mt-1 text-sm text-stone-500">
            A private view of @{username}&apos;s quotes, posts, reviews, likes, and replies.
          </p>
        </div>
        <Link href="/quotes" className="whitespace-nowrap rounded border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Add quote
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metric('Quotes', counts.quotes, '/settings/activity?tab=quotes')}
        {metric('Posts', counts.posts, '/settings/activity?tab=posts')}
        {metric('Reviews', counts.reviews, '/settings/activity?tab=reviews')}
        {metric('Likes', counts.likes, '/settings/activity?tab=likes')}
        {metric('Replies', counts.replies, '/settings/activity?tab=replies')}
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b border-stone-200 pb-2">
        {TABS.map((name) => (
          <Link
            key={name}
            href={name === 'overview' ? '/settings/activity' : `/settings/activity?tab=${name}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
              tab === name
                ? 'bg-brand text-white'
                : 'bg-white text-stone-600 hover:bg-brand-soft hover:text-brand'
            }`}
          >
            {TAB_LABEL[name]}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="space-y-6">
          <ActivitySection title="Recent quotes" href="/settings/activity?tab=quotes" empty={quotes.length === 0}>
            {quotes.map(quoteCard)}
          </ActivitySection>
          <ActivitySection title="Recent posts" href="/settings/activity?tab=posts" empty={posts.length === 0}>
            {posts.map((post) => postCard(post, authors.get(post.user_id)))}
          </ActivitySection>
          <ActivitySection title="Recent reviews" href="/settings/activity?tab=reviews" empty={reviews.length === 0}>
            {reviews.map(reviewCard)}
          </ActivitySection>
          <ActivitySection title="Recent likes" href="/settings/activity?tab=likes" empty={likes.length === 0}>
            {likes.map(likeCard)}
          </ActivitySection>
          <ActivitySection title="Recent replies" href="/settings/activity?tab=replies" empty={replies.length === 0}>
            {replies.map(replyCard)}
          </ActivitySection>
        </div>
      )}

      {tab !== 'overview' && (
        <ul className="space-y-3">
          {tab === 'quotes' && quotes.map(quoteCard)}
          {tab === 'posts' && posts.map((post) => postCard(post, authors.get(post.user_id)))}
          {tab === 'reviews' && reviews.map(reviewCard)}
          {tab === 'likes' && likes.map(likeCard)}
          {tab === 'replies' && replies.map(replyCard)}
          {((tab === 'quotes' && quotes.length === 0) ||
            (tab === 'posts' && posts.length === 0) ||
            (tab === 'reviews' && reviews.length === 0) ||
            (tab === 'likes' && likes.length === 0) ||
            (tab === 'replies' && replies.length === 0)) && (
            <li className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
              {emptyText(tab)}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ActivitySection({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">{title}</h2>
        <Link href={href} className="text-sm font-medium text-brand hover:underline">
          View all
        </Link>
      </div>
      {empty ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-5 text-center text-sm text-stone-400">
          Nothing here yet.
        </p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </section>
  );
}
