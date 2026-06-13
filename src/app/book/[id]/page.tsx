import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import { saveRating, saveReview, deleteReview } from '@/app/actions/reviews';
import { removeFromShelf } from '@/app/actions/shelf';

const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);

export default async function BookPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { edit?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Load the book.
  const { data: book } = await supabase
    .from('books')
    .select('id, title, author, cover_id')
    .eq('id', params.id)
    .single();
  if (!book) notFound();

  // 2. This user's rating + shelf status.
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

  // 3. All reviews for this book (newest first), with author names.
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, user_id, body, spoiler, created_at, profiles ( username, display_name )')
    .eq('book_id', book.id)
    .order('created_at', { ascending: false });
  const reviewList = reviews ?? [];

  // Are we editing one of my reviews? (?edit=<reviewId>)
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
            <Image
              src={cover}
              alt={book.title}
              width={140}
              height={210}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-bold">{book.title}</h1>
          <p className="mb-4 text-slate-500">{book.author}</p>

          {user ? (
            <form action={saveRating} className="flex items-center gap-2">
              <input type="hidden" name="bookId" value={book.id} />
              <label className="text-sm text-slate-600">Your rating:</label>
              <select
                name="rating"
                defaultValue={myRating ?? ''}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="">—</option>
                {RATING_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r.toFixed(1)} ★
                  </option>
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
              <button className="text-sm text-red-600 hover:underline">
                Remove from shelf
              </button>
            </form>
          )}
        </div>
      </div>

      {/* --- Write / edit a review (always available, clears after posting) --- */}
      {user && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">
            {editingReview ? 'Edit your review' : 'Write a review'}
          </h2>
          <form action={saveReview} className="space-y-2">
            <input type="hidden" name="bookId" value={book.id} />
            {/* When editing, this hidden field tells the action which review to update */}
            {editingReview && (
              <input type="hidden" name="reviewId" value={editingReview.id} />
            )}
            <textarea
              name="body"
              rows={4}
              defaultValue={editingReview?.body ?? ''}
              placeholder="What did you think?"
              className="w-full rounded border border-slate-300 p-3"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="spoiler"
                  defaultChecked={editingReview?.spoiler ?? false}
                />
                Contains spoilers
              </label>
              <div className="flex items-center gap-3">
                {editingReview && (
                  <Link
                    href={`/book/${book.id}`}
                    className="text-sm text-slate-500 hover:underline"
                  >
                    Cancel
                  </Link>
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
        <h2 className="mb-3 text-lg font-semibold">
          Reviews ({reviewList.length})
        </h2>
        {reviewList.length === 0 && (
          <p className="text-slate-500">No reviews yet. Be the first.</p>
        )}
        <ul className="space-y-4">
          {reviewList.map((rev: any) => {
            const mine = rev.user_id === user?.id;
            return (
              <li
                key={rev.id}
                className={`rounded border p-4 ${
                  mine ? 'border-brand/40 bg-brand/5' : 'border-slate-200 bg-white'
                }`}
              >
                <p className="mb-1 text-sm font-medium">
                  @{rev.profiles?.username ?? 'reader'}
                  {mine && (
                    <span className="ml-2 rounded bg-brand px-2 py-0.5 text-xs text-white">
                      you
                    </span>
                  )}
                  {rev.spoiler && (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      spoiler
                    </span>
                  )}
                </p>
                <p className="whitespace-pre-wrap text-slate-700">{rev.body}</p>

                {mine && (
                  <div className="mt-2 flex gap-4 text-sm">
                    <Link
                      href={`/book/${book.id}?edit=${rev.id}`}
                      className="text-brand hover:underline"
                    >
                      Edit
                    </Link>
                    <form action={deleteReview}>
                      <input type="hidden" name="bookId" value={book.id} />
                      <input type="hidden" name="reviewId" value={rev.id} />
                      <button className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
