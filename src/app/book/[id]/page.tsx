import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import {
  saveRating,
  saveReview,
  deleteReview,
  reactToReview,
} from '@/app/actions/reviews';
import { removeFromShelf } from '@/app/actions/shelf';

const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { edit?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: book } = await supabase
    .from('books')
    .select('id, title, author, cover_id')
    .eq('id', params.id)
    .single();
  if (!book) notFound();

  let myRating: number | null = null;
  let onShelf = false;
  if (user) {
    const { data: entry } = await supabase
      .from('reading_entries')
      .select('rating')
      .eq('user_id', user.id)
      .eq('book_id', book.id)
      .maybeSingle();
    myRating = entry?.rating ?? null;
    onShelf = !!entry;
  }

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, user_id, body, spoiler, created_at, profiles ( username, display_name )')
    .eq('book_id', book.id)
    .order('created_at', { ascending: false });
  const reviewList = reviews ?? [];

  // --- Reactions for all reviews on this page (one query) ---
  const reviewIds = reviewList.map((r: any) => r.id);
  let reactions: any[] = [];
  const reactorName = new Map<string, string>();
  if (reviewIds.length) {
    const { data: rx } = await supabase
      .from('review_reactions')
      .select('review_id, user_id, type')
      .in('review_id', reviewIds);
    reactions = rx ?? [];

    const reactorIds = Array.from(new Set(reactions.map((r) => r.user_id)));
    if (reactorIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', reactorIds);
      (profs ?? []).forEach((p: any) => reactorName.set(p.id, p.username));
    }
  }

  const editingId = searchParams?.edit ?? null;
  const editingReview = editingId
    ? reviewList.find((r: any) => r.id === editingId && r.user_id === user?.id)
    : null;

  const cover = coverUrl(book.cover_id, 'L');

  return (
    <div>
      {/* --- Book header --- */}
      <div className="flex gap-6">
        <div className="h-[210px] w-[140px] flex-shrink-0 overflow-hidden rounded bg-slate-200">
          {cover && (
            <Image src={cover} alt={book.title} width={140} height={210}
              className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{book.title}</h1>
          <p className="mb-4 text-slate-500">{book.author}</p>
          {user ? (
            <form action={saveRating} className="flex items-center gap-2">
              <input type="hidden" name="bookId" value={book.id} />
              <label className="text-sm text-slate-600">Your rating:</label>
              <select name="rating" defaultValue={myRating ?? ''}
                className="rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="">—</option>
                {RATING_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r.toFixed(1)} ★</option>
                ))}
              </select>
              <button className="rounded bg-brand px-3 py-1 text-sm font-medium text-white hover:opacity-90">
                Save
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-400">Log in to rate this book.</p>
          )}
          {user && onShelf && (
            <form action={removeFromShelf} className="mt-3">
              <input type="hidden" name="bookId" value={book.id} />
              <button className="text-sm text-red-600 hover:underline">Remove from shelf</button>
            </form>
          )}
        </div>
      </div>

      {/* --- Write / edit a review --- */}
      {user && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">
            {editingReview ? 'Edit your review' : 'Write a review'}
          </h2>
          <form key={`${editingId ?? 'new'}-${reviewList.length}`} action={saveReview} className="space-y-2">
            <input type="hidden" name="bookId" value={book.id} />
            {editingReview && <input type="hidden" name="reviewId" value={editingReview.id} />}
            <textarea name="body" rows={4} defaultValue={editingReview?.body ?? ''}
              placeholder="What did you think?" className="w-full rounded border border-slate-300 p-3" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="spoiler" defaultChecked={editingReview?.spoiler ?? false} />
                Contains spoilers
              </label>
              <div className="flex items-center gap-3">
                {editingReview && (
                  <Link href={`/book/${book.id}`} className="text-sm text-slate-500 hover:underline">Cancel</Link>
                )}
                <button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                  {editingReview ? 'Update review' : 'Post review'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* --- All reviews --- */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Reviews ({reviewList.length})</h2>
        {reviewList.length === 0 && <p className="text-slate-500">No reviews yet. Be the first.</p>}
        <ul className="space-y-4">
          {reviewList.map((rev: any) => {
            const mine = rev.user_id === user?.id;
            const rx = reactions.filter((r) => r.review_id === rev.id);
            const likers = rx.filter((r) => r.type === 'like');
            const dislikers = rx.filter((r) => r.type === 'dislike');
            const myReaction = rx.find((r) => r.user_id === user?.id)?.type ?? null;

            return (
              <li key={rev.id}
                className={`relative rounded border p-4 ${mine ? 'border-brand/40 bg-brand/5' : 'border-slate-200 bg-white'}`}>
                {mine && (
                  <Link href={`/book/${book.id}?edit=${rev.id}`} title="Edit review"
                    className="absolute right-3 top-3 text-slate-400 hover:text-brand">
                    <PencilIcon />
                  </Link>
                )}

                <p className="mb-1 pr-6 text-sm font-medium">
                  <Link href={`/u/${rev.profiles?.username}`} className="hover:underline">
                    @{rev.profiles?.username ?? 'reader'}
                  </Link>
                  {mine && <span className="ml-2 rounded bg-brand px-2 py-0.5 text-xs text-white">you</span>}
                  {rev.spoiler && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">spoiler</span>}
                </p>
                <p className="whitespace-pre-wrap text-slate-700">{rev.body}</p>

                {/* --- Like / dislike --- */}
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <form action={reactToReview}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <input type="hidden" name="reviewId" value={rev.id} />
                    <input type="hidden" name="type" value="like" />
                    <button title="Like"
                      className={`rounded-full border px-3 py-1 ${myReaction === 'like' ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                      👍 {likers.length}
                    </button>
                  </form>
                  <form action={reactToReview}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <input type="hidden" name="reviewId" value={rev.id} />
                    <input type="hidden" name="type" value="dislike" />
                    <button title="Dislike"
                      className={`rounded-full border px-3 py-1 ${myReaction === 'dislike' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                      👎 {dislikers.length}
                    </button>
                  </form>

                  {mine && (
                    <form action={deleteReview} className="ml-auto">
                      <input type="hidden" name="bookId" value={book.id} />
                      <input type="hidden" name="reviewId" value={rev.id} />
                      <button title="Delete review" className="text-slate-400 hover:text-red-600">
                        <TrashIcon />
                      </button>
                    </form>
                  )}
                </div>

                {/* Who liked (clickable) */}
                {likers.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Liked by{' '}
                    {likers.map((r, i) => {
                      const uname = reactorName.get(r.user_id);
                      return (
                        <span key={r.user_id}>
                          <Link href={`/u/${uname}`} className="hover:text-brand hover:underline">
                            @{uname}
                          </Link>
                          {i < likers.length - 1 ? ', ' : ''}
                        </span>
                      );
                    })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
