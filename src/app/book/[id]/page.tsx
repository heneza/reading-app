import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl, fetchDescription } from '@/lib/openlibrary';
import {
  reactToReview,
  addReviewComment,
  deleteReviewComment,
} from '@/app/actions/reviews';
import ReviewForm from './ReviewForm';
import ReviewItem from './ReviewItem';
import { removeFromShelf } from '@/app/actions/shelf';
import { logRead, deleteDiaryEntry } from '@/app/actions/diary';
import { addContentWarning, removeContentWarning } from '@/app/actions/content-warnings';
import { addBookToList } from '@/app/actions/lists';
import { classifyBook } from '@/app/actions/genres';
import { genreName } from '@/lib/genres';
import StarRating from '@/components/StarRating';
import { timeAgo, formatDate } from '@/lib/time';

// Always render fresh (no caching) so data and login state are current.
export const dynamic = 'force-dynamic';

export default async function BookPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: book } = await supabase
    .from('books').select('id, title, author, cover_id, ol_key, description').eq('id', params.id).single();
  if (!book) notFound();

  // Description: use the cached copy; only hit Open Library the first time.
  let description: string = book.description ?? '';
  if (!description && book.ol_key) {
    description = await fetchDescription(book.ol_key);
    if (description && user) {
      await supabase.from('books').update({ description }).eq('id', book.id);
    }
  }
  const today = new Date().toISOString().slice(0, 10);

  let myRating: number | null = null;
  let onShelf = false;
  if (user) {
    const { data: entry } = await supabase
      .from('reading_entries').select('rating')
      .eq('user_id', user.id).eq('book_id', book.id).maybeSingle();
    myRating = entry?.rating ?? null;
    onShelf = !!entry;
  }

  // This user's diary entries for this book (most recent read first).
  let myDiary: any[] = [];
  if (user) {
    const { data: de } = await supabase
      .from('diary_entries')
      .select('id, read_on, rating, note, is_reread')
      .eq('user_id', user.id)
      .eq('book_id', book.id)
      .order('read_on', { ascending: false })
      .order('created_at', { ascending: false });
    myDiary = de ?? [];
  }

  // Content warnings (community-contributed): aggregate distinct warnings.
  const { data: cwRows } = await supabase
    .from('content_warnings')
    .select('warning, user_id')
    .eq('book_id', book.id);
  const cwAgg = new Map<string, { count: number; mine: boolean }>();
  (cwRows ?? []).forEach((r: any) => {
    const cur = cwAgg.get(r.warning) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.user_id === user?.id) cur.mine = true;
    cwAgg.set(r.warning, cur);
  });
  const warnings = Array.from(cwAgg.entries())
    .map(([warning, v]) => ({ warning, count: v.count, mine: v.mine }))
    .sort((a, b) => b.count - a.count);

  // The signed-in user's lists + which already contain this book.
  let myLists: { id: string; title: string }[] = [];
  const inLists = new Set<string>();
  if (user) {
    const { data: ml } = await supabase
      .from('lists')
      .select('id, title')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    myLists = ml ?? [];
    if (myLists.length) {
      const { data: li } = await supabase
        .from('list_items')
        .select('list_id')
        .eq('book_id', book.id)
        .in('list_id', myLists.map((l) => l.id));
      (li ?? []).forEach((r: any) => inLists.add(r.list_id));
    }
  }

  // Genres for this book — classify on first view if not done yet.
  let bookGenres: string[] = [];
  {
    const { data: bg } = await supabase
      .from('book_genres')
      .select('genre')
      .eq('book_id', book.id);
    bookGenres = (bg ?? []).map((r: any) => r.genre);
    if (bookGenres.length === 0 && user && book.ol_key) {
      try {
        bookGenres = await classifyBook(book.id, book.ol_key);
      } catch {
        /* non-critical */
      }
    }
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
  const avatarById = new Map<string, string | null>();

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
      const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
      (profs ?? []).forEach((p: any) => {
        nameById.set(p.id, p.username);
        avatarById.set(p.id, p.avatar_url);
      });
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
          <p className="mb-2 text-slate-500">{book.author}</p>
          {bookGenres.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {bookGenres.map((slug: string) => (
                <span key={slug} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
                  {genreName(slug)}
                </span>
              ))}
            </div>
          )}
          {description && (
            <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {description.length > 600 ? description.slice(0, 600).trimEnd() + '…' : description}
            </p>
          )}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Your rating:</span>
              <StarRating bookId={book.id} initial={myRating} />
            </div>
          ) : (
            <p className="text-sm text-slate-400">Log in to rate this book.</p>
          )}
          {user && onShelf && (
            <form action={removeFromShelf} className="mt-3">
              <input type="hidden" name="bookId" value={book.id} />
              <button className="text-sm text-red-600 hover:underline">Remove from shelf</button>
            </form>
          )}
          {user && (
            <div className="mt-3">
              {myLists.length > 0 ? (
                <form action={addBookToList} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="bookId" value={book.id} />
                  <select name="listId" className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-700">
                    {myLists.map((l) => (
                      <option key={l.id} value={l.id} disabled={inLists.has(l.id)}>{l.title}{inLists.has(l.id) ? ' (added)' : ''}</option>
                    ))}
                  </select>
                  <button className="rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:border-brand hover:text-brand">Add to list</button>
                </form>
              ) : (
                <Link href="/lists" className="text-sm text-brand hover:underline">Create a list →</Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Content warnings --- */}
      <section className="mt-6">
        <details className="rounded-lg border border-stone-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-stone-700">
            Content warnings{warnings.length > 0 ? ` (${warnings.length})` : ''}
          </summary>
          <div className="mt-3">
            {warnings.length === 0 ? (
              <p className="text-sm text-stone-500">None flagged yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {warnings.map((w) => (
                  <li key={w.warning} className="flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                    <span>{w.warning}</span>
                    <span className="text-stone-400">{w.count}</span>
                    {w.mine && (
                      <form action={removeContentWarning} className="inline">
                        <input type="hidden" name="bookId" value={book.id} />
                        <input type="hidden" name="warning" value={w.warning} />
                        <button title="Remove your flag" className="ml-0.5 text-stone-400 hover:text-red-600">×</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {user ? (
              <form action={addContentWarning} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="bookId" value={book.id} />
                <input name="warning" list="cw-suggestions" placeholder="Add a content warning…" maxLength={60} className="flex-1 rounded border border-slate-300 px-3 py-1 text-sm" />
                <datalist id="cw-suggestions">
                  {['Violence', 'Death', 'Gore', 'Sexual assault', 'Abuse', 'Domestic abuse', 'Child abuse', 'Self-harm', 'Suicide', 'Eating disorder', 'Addiction', 'Animal cruelty', 'Racism', 'Homophobia', 'Transphobia', 'Misogyny', 'War', 'Torture', 'Kidnapping', 'Mental illness', 'Medical content', 'Pregnancy', 'Miscarriage'].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <button className="rounded bg-slate-700 px-3 py-1 text-sm text-white hover:opacity-90">Add</button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-stone-400">Log in to flag a content warning.</p>
            )}
          </div>
        </details>
      </section>

      {/* --- Reading diary --- */}
      {user && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Reading diary</h2>
          <p className="mb-3 text-sm text-slate-500">
            {myDiary.length === 0
              ? 'Log each time you read this book.'
              : `You've read this ${myDiary.length} time${myDiary.length === 1 ? '' : 's'}.`}
          </p>

          {/* Log a read */}
          <form action={logRead} className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-3">
            <input type="hidden" name="bookId" value={book.id} />
            <label className="flex flex-col text-xs text-slate-500">
              Date read
              <input type="date" name="readOn" defaultValue={today} max={today} className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm text-slate-700" />
            </label>
            <label className="flex flex-col text-xs text-slate-500">
              Rating (optional)
              <input type="number" name="rating" min="0" max="5" step="0.25" placeholder="—" className="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm text-slate-700" />
            </label>
            <label className="flex flex-1 flex-col text-xs text-slate-500">
              Note (optional)
              <input name="note" maxLength={280} placeholder="A line about this read…" className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm text-slate-700" />
            </label>
            <button className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">Log read</button>
          </form>

          {/* Past reads */}
          {myDiary.length > 0 && (
            <ul className="space-y-2">
              {myDiary.map((d: any) => (
                <li key={d.id} className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700">
                      {formatDate(d.read_on)}
                      {d.is_reread && <span title="Reread" className="ml-2 text-brand">↻ reread</span>}
                      {d.rating != null && <span className="ml-2 text-stone-500">{Number(d.rating)}★</span>}
                    </p>
                    {d.note && <p className="mt-1 whitespace-pre-wrap text-slate-600">{d.note}</p>}
                  </div>
                  <form action={deleteDiaryEntry}>
                    <input type="hidden" name="entryId" value={d.id} />
                    <input type="hidden" name="bookId" value={book.id} />
                    <button title="Delete entry" className="text-stone-300 hover:text-red-600">×</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
                avatarUrl={avatarById.get(rev.user_id) ?? null}
                createdAt={rev.created_at}
                body={rev.body}
                spoiler={rev.spoiler}
                mine={mine}
              >
                {/* like / dislike */}
                <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                  <form action={reactToReview}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <input type="hidden" name="reviewId" value={rev.id} />
                    <input type="hidden" name="type" value="like" />
                    <button className={`rounded-full border px-3 py-1 ${myReaction === 'like' ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>Like {likers.length}</button>
                  </form>
                  <form action={reactToReview}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <input type="hidden" name="reviewId" value={rev.id} />
                    <input type="hidden" name="type" value="dislike" />
                    <button className={`rounded-full border px-3 py-1 ${myReaction === 'dislike' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>Dislike {dislikers.length}</button>
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
                              {c.body}{' '}
                              <span className="text-xs text-stone-400">· {timeAgo(c.created_at)}</span>
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
