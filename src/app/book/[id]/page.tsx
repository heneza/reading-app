import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import { saveRating, saveReview } from '@/app/actions/reviews';
import { removeFromShelf } from '@/app/actions/shelf';

// Options for the rating dropdown: 0.5, 1.0, ... 5.0
const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);

export default async function BookPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Load the book itself.
  const { data: book } = await supabase
    .from('books')
    .select('id, title, author, cover_id')
    .eq('id', params.id)
    .single();

  if (!book) notFound(); // shows the 404 page if the id is wrong

  // 2. Load THIS user's rating, shelf status, and their own review.
  let myRating: number | null = null;
  let onShelf = false;
  let myReview: { body: string; spoiler: boolean } | null = null;
  if (user) {
    const { data: entry } = await supabase
      .from('reading_entries')
      .select('rating')
      .eq('user_id', user.id)
      .eq('book_id', book.id)
      .maybeSingle();
    myRating = entry?.rating ?? null;
    onShelf = !!entry; // true if a reading entry exists

    const { data: r } = await supabase
      .from('reviews')
      .select('body, spoiler')
      .eq('user_id', user.id)
      .eq('book_id', book.id)
      .maybeSingle();
    myReview = r ?? null;
  }

  // 3. Load ALL reviews for this book, with each reviewer's name.
  const { data: reviews } = await supabase
    .from('reviews')
    .select('body, spoiler, created_at, profiles ( username, display_name )')
    .eq('book_id', book.id)
    .order('created_at', { ascending: false });

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

          {/* --- Rating form --- */}
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

          {/* --- Remove from shelf (only if it's on your shelf) --- */}
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

      {/* --- Write a review --- */}
      {user && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">
            {myReview ? 'Edit your review' : 'Write a review'}
          </h2>
          <form action={saveReview} className="space-y-2">
            <input type="hidden" name="bookId" value={book.id} />
            <textarea
              name="body"
              rows={4}
              defaultValue={myReview?.body ?? ''}
              placeholder="What did you think?"
              className="w-full rounded border border-slate-300 p-3"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="spoiler"
                  defaultChecked={myReview?.spoiler ?? false}
                />
                Contains spoilers
              </label>
              <button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                {myReview ? 'Update review' : 'Post review'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* --- All reviews --- */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">
          Reviews ({reviews?.length ?? 0})
        </h2>
        {(!reviews || reviews.length === 0) && (
          <p className="text-slate-500">No reviews yet. Be the first.</p>
        )}
        <ul className="space-y-4">
          {reviews?.map((rev: any, i: number) => (
            <li key={i} className="rounded border border-slate-200 bg-white p-4">
              <p className="mb-1 text-sm font-medium">
                {rev.profiles?.display_name ?? rev.profiles?.username ?? 'Reader'}
                {rev.spoiler && (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                    spoiler
                  </span>
                )}
              </p>
              <p className="whitespace-pre-wrap text-slate-700">{rev.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
