import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import {
  saveRating,
  reactToReview,
  addReviewComment,
  deleteReviewComment,
} from '@/app/actions/reviews';
import ReviewForm from './ReviewForm';
import ReviewItem from './ReviewItem';
import { removeFromShelf } from '@/app/actions/shelf';

const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);

// Always render fresh (no caching) so data and login state are current.
export const dynamic = 'force-dynamic';

export default async function BookPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: book } = await supabase
    .from('books').select('id, title, author, cover_id').eq('id', params.id).single();
  if (!book) notFound();

  let myRating: number | null = null;
  let onShelf = false;
  if (user) {
    const { data: entry } = await supabase
      .from('reading_entries').select('rating')
      .eq('user_id', user.id).eq('book_id', book.id).maybeSingle();
    myRating = entry?.rating ?? null;
    onShelf = !!entry;
  }

  const { data: reviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('id, user_id, body, spoiler, created_at')
    .eq('book_id', book.id)
    .order('created_at', { ascending: false });
  const reviewList = reviews ?? [];
  const reviewIds = reviewList.map((r: any) => r.id);

  // Reactions + comments for all reviews (bulk fetch)
  let reactions: any[] = [];
  let comments: any[] = [];
  const nameById = new Map<string, string>();

  if (reviewIds.length) {
    const [{ data: rx }, { data: cm }] = await Promise.all([
      supabase.from('review_reactions').select('review_id, user_id, type').in('review_id', reviewIds),
      supabase.from('review_comments').select('id, review_id, user_id, body, created_at')
        .in('review_id', reviewIds).order('created_at', { ascending: true }),
    ]);
    reactions = rx ?? [];
    comments = cm ?? [];

    // Look up usernames for review authors, reactors and commenters in one go.
    const ids = Array.from(new Set([
      ...reviewList.map((r: any) => r.user_id),
      ...reactions.map((r) => r.user_id),
      ...comments.map((c) => c.user_id),
    ]));
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids);
      (profs ?? []).forEach((p: any) => nameById.set(p.id, p.username));
    }
  }

  const cover = coverUrl(book.cover_id, 'L');

  return (
    <div>
      {/* --- Book header --- */}
      <div className="flex gap-6">
        <div className="h-[210px] w-[140px] flex-shrink-0 overflow-hidden rounded bg-slate-200">
          {cover && <Image src={cover} alt={book.title} width={140} height={210} className="h-full w-full object-cover" />}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{book.title}</h1>
          <p className="mb-4 text-slate-500">{book.author}</p>
          {user ? (
            <form action={saveRating} className="flex items-center gap-2">
              <input type="hidden" name="bookId" value={book.id} />
              <label className="text-sm text-slate-600">Your rating:</label>
              <select name="rating" defaultValue={myRating ?? ''} className="min-w-[4.5rem]">
                <option value="">—</option>
                {RATING_OPTIONS.map((r) => <option key={r} value={r}>{r.toFixed(1)} ★</option>)}
              </select>
              <button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark">Save</button>
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

      {/* --- Write a review --- */}
      {user && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Write a review</h2>
          <ReviewForm bookId={book.id} />
        </section>
      )}

      {/* --- All reviews --- */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Reviews ({reviewList.length})</h2>

        {reviewsError && (
          <p className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            Could not load reviews: {reviewsError.message}
          </p>
        )}

        {reviewList.length === 0 && !reviewsError && (
          <p className="text-slate-500">No reviews yet. Be the first.</p>
        )}

        <ul className="space-y-4">
          {reviewList.map((rev: any) => {
            const mine = rev.user_id === user?.id;
            const rx = reactions.filter((r) => r.review_id === rev.id);
            const likers = rx.filter((r) => r.type === 'like');
            const dislikers = rx.filter((r) => r.type === 'dislike');
            const myReaction = rx.find((r) => r.user_id === user?.id)?.type ?? null;
            const revComments = comments.filter((c) => c.review_id === rev.id);

            return (
              <ReviewItem
                key={rev.id}
                bookId={book.id}
                reviewId={rev.id}
                username={nameById.get(rev.user_id) ?? null}
                body={rev.body}
                spoiler={rev.spoiler}
                mine={mine}
              >
                {/* like / dislike */}
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <form action={reactToReview}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <input type="hidden" name="reviewId" value={rev.id} />
                    <input type="hidden" name="type" value="like" />
                    <button className={`rounded-full border px-3 py-1 ${myReaction === 'like' ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>👍 {likers.length}</button>
                  </form>
                  <form action={reactToReview}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <input type="hidden" name="reviewId" value={rev.id} />
                    <input type="hidden" name="type" value="dislike" />
                    <button className={`rounded-full border px-3 py-1 ${myReaction === 'dislike' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>👎 {dislikers.length}</button>
                  </form>
                </div>

                {likers.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Liked by{' '}
                    {likers.map((r, i) => {
                      const uname = nameById.get(r.user_id);
                      return (
                        <span key={r.user_id}>
                          <Link href={`/u/${uname}`} className="hover:text-brand hover:underline">@{uname}</Link>
                          {i < likers.length - 1 ? ', ' : ''}
                        </span>
                      );
                    })}
                  </p>
                )}

                {/* --- Replies --- */}
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {revComments.length > 0 && (
                    <ul className="mb-2 space-y-2">
                      {revComments.map((c) => {
                        const uname = nameById.get(c.user_id);
                        const mineC = c.user_id === user?.id;
                        return (
                          <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                            <p className="text-slate-700">
                              <Link href={`/u/${uname}`} className="font-medium hover:text-brand hover:underline">@{uname}</Link>{' '}
                              {c.body}
                            </p>
                            {mineC && (
                              <form action={deleteReviewComment}>
                                <input type="hidden" name="bookId" value={book.id} />
                                <input type="hidden" name="commentId" value={c.id} />
                                <button title="Delete reply" className="text-slate-300 hover:text-red-600">×</button>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {user && (
                    <form action={addReviewComment} className="flex gap-2">
                      <input type="hidden" name="bookId" value={book.id} />
                      <input type="hidden" name="reviewId" value={rev.id} />
                      <input name="body" placeholder="Write a reply…" className="flex-1 rounded border border-slate-300 px-3 py-1 text-sm" />
                      <button className="rounded bg-slate-700 px-3 py-1 text-sm text-white hover:opacity-90">Reply</button>
                    </form>
                  )}
                </div>
              </ReviewItem>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
