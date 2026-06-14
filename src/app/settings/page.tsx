import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { signout } from '@/app/login/actions';
import { timeAgo } from '@/lib/time';
import ReadReceiptsToggle from './ReadReceiptsToggle';

export const dynamic = 'force-dynamic';

const SUPPORT = [
  { label: 'nesha — Founder / Dev', email: 'spada.vanesa@gmail.com' },
  { label: 'Niki — Founder / Dev', email: 'nikistruga111@gmail.com' },
];

const sectionH = 'mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400';

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, read_receipts')
    .eq('id', user.id)
    .maybeSingle();

  // Reviews you liked
  const { data: likedRx } = await supabase
    .from('review_reactions')
    .select('review_id')
    .eq('user_id', user.id)
    .eq('type', 'like');
  const likedIds = Array.from(new Set((likedRx ?? []).map((r: any) => r.review_id)));
  let likedReviews: any[] = [];
  if (likedIds.length) {
    const { data } = await supabase
      .from('reviews')
      .select('id, body, book_id, books ( title )')
      .in('id', likedIds)
      .limit(10);
    likedReviews = data ?? [];
  }

  // Your reviews
  const { data: myReviewsData } = await supabase
    .from('reviews')
    .select('id, body, book_id, created_at, books ( title )')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);
  const myReviews = myReviewsData ?? [];

  // Your replies (resolve the book each belongs to)
  const { data: myCommentsData } = await supabase
    .from('review_comments')
    .select('id, body, created_at, review_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);
  const myComments = myCommentsData ?? [];
  const cReviewIds = Array.from(new Set(myComments.map((c: any) => c.review_id)));
  const bookByReview = new Map<string, any>();
  if (cReviewIds.length) {
    const { data: rv } = await supabase
      .from('reviews')
      .select('id, book_id, books ( title )')
      .in('id', cReviewIds);
    (rv ?? []).forEach((r: any) => bookByReview.set(r.id, r));
  }

  return (
    <div className="mx-auto max-w-lg space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-stone-500">@{profile?.username}</p>
      </div>

      {/* Account */}
      <section>
        <h2 className={sectionH}>Account</h2>
        <div className="space-y-1 rounded-lg border border-stone-200 bg-white p-4 text-sm">
          <p>
            <span className="text-stone-500">Username:</span> @{profile?.username}
          </p>
          <p>
            <span className="text-stone-500">Email:</span> {user.email}
          </p>
          <Link
            href="/settings/profile"
            className="mt-2 inline-block font-medium text-brand hover:underline"
          >
            Edit profile →
          </Link>
        </div>
      </section>

      {/* Your activity */}
      <section>
        <h2 className={sectionH}>Your activity</h2>

        <h3 className="mb-2 text-sm font-medium">Reviews you liked ({likedReviews.length})</h3>
        {likedReviews.length === 0 ? (
          <p className="mb-5 text-sm text-stone-400">No liked reviews yet.</p>
        ) : (
          <ul className="mb-5 space-y-2">
            {likedReviews.map((r: any) => (
              <li key={r.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <Link href={`/book/${r.book_id}`} className="font-medium hover:text-brand hover:underline">
                  {r.books?.title}
                </Link>
                <p className="truncate text-stone-500">{r.body}</p>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-2 text-sm font-medium">Your reviews ({myReviews.length})</h3>
        {myReviews.length === 0 ? (
          <p className="mb-5 text-sm text-stone-400">You have not written any reviews yet.</p>
        ) : (
          <ul className="mb-5 space-y-2">
            {myReviews.map((r: any) => (
              <li key={r.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/book/${r.book_id}`} className="font-medium hover:text-brand hover:underline">
                    {r.books?.title}
                  </Link>
                  <span className="flex-shrink-0 text-xs text-stone-400">{timeAgo(r.created_at)}</span>
                </div>
                <p className="truncate text-stone-500">{r.body}</p>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-2 text-sm font-medium">Your replies ({myComments.length})</h3>
        {myComments.length === 0 ? (
          <p className="text-sm text-stone-400">You have not replied to anything yet.</p>
        ) : (
          <ul className="space-y-2">
            {myComments.map((c: any) => {
              const rv = bookByReview.get(c.review_id);
              return (
                <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    {rv ? (
                      <Link href={`/book/${rv.book_id}`} className="font-medium hover:text-brand hover:underline">
                        on {rv.books?.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-stone-500">a review</span>
                    )}
                    <span className="flex-shrink-0 text-xs text-stone-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="truncate text-stone-500">{c.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Privacy & security */}
      <section>
        <h2 className={sectionH}>Privacy &amp; security</h2>
        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <p>
            Your profile, shelf, ratings, and reviews are{' '}
            <span className="font-medium">public</span> so other readers can
            discover you. Direct messages stay private between you and the
            recipient.
          </p>
          <ReadReceiptsToggle initial={profile?.read_receipts !== false} />
          <form action={signout}>
            <button className="rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
              Sign out
            </button>
          </form>
        </div>
      </section>

      {/* Help & support */}
      <section>
        <h2 className={sectionH}>Help &amp; support</h2>
        <div className="space-y-2 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <p>Questions, ideas, or found a bug? Reach the team:</p>
          <ul className="space-y-1">
            {SUPPORT.map((c) => (
              <li key={c.email}>
                <a
                  href={`mailto:${c.email}?subject=Reading%20App%20support`}
                  className="font-medium text-brand hover:underline"
                >
                  {c.label}
                </a>
                <span className="text-stone-400"> · {c.email}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
