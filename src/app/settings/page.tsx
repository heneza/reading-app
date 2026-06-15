import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { requestPasswordReset, signout } from '@/app/login/actions';
import { setVisibility } from '@/app/actions/profile';
import { setAiEnabled, setEmailPreferences } from '@/app/actions/account';
import DeleteAccount from './DeleteAccount';
import { timeAgo } from '@/lib/time';
import ReadReceiptsToggle from './ReadReceiptsToggle';
import ThemeToggle from './ThemeToggle';
import Turnstile from '@/components/Turnstile';

export const dynamic = 'force-dynamic';

const SUPPORT = [
  { label: 'nesha — Founder / Dev', email: 'spada.vanesa@gmail.com' },
  { label: 'Niki — Founder / Dev', email: 'nikistruga111@gmail.com' },
];

const sectionH = 'mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
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

      {searchParams.error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.message && (
        <p className="rounded bg-green-50 p-3 text-sm text-green-700">{searchParams.message}</p>
      )}

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

      {/* Appearance */}
      <section>
        <h2 className={sectionH}>Appearance</h2>
        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <p>Choose how Reading App looks on this device.</p>
          <ThemeToggle />
        </div>
      </section>

      {/* Import */}
      <section>
        <h2 className={sectionH}>Import</h2>
        <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
          <Link href="/settings/import" className="font-medium text-brand hover:underline">Import from Goodreads, StoryGraph or Hardcover →</Link>
          <p className="mt-1 text-stone-500">Bring your shelves, ratings and reviews over from a CSV (Goodreads, StoryGraph) or JSON (Hardcover) export.</p>
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

          <form action={requestPasswordReset} className="space-y-2 border-t border-stone-100 pt-3">
            <input type="hidden" name="email" value={user.email ?? ''} />
            <input type="hidden" name="next" value="/settings" />
            <p>
              Need to change your password? Send a reset link to{' '}
              <span className="font-medium text-stone-700">{user.email}</span>.
            </p>
            {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
            )}
            <button className="rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
              Send password reset email
            </button>
          </form>

          <form action={setVisibility} className="space-y-2 border-t border-stone-100 pt-3">
            <label className="flex items-center justify-between gap-3">
              <span>Who can see your likes</span>
              <select name="likes_visibility" defaultValue={profile?.likes_visibility ?? 'public'}>
                <option value="public">Everyone</option>
                <option value="friends">Friends only</option>
                <option value="private">Only me</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Who can see your replies</span>
              <select name="comments_visibility" defaultValue={profile?.comments_visibility ?? 'public'}>
                <option value="public">Everyone</option>
                <option value="friends">Friends only</option>
                <option value="private">Only me</option>
              </select>
            </label>
            <button className="rounded bg-brand px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-dark">Save visibility</button>
          </form>
          <form action={signout}>
            <button className="rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
              Sign out
            </button>
          </form>
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h2 className={sectionH}>Notifications</h2>
        <form action={setEmailPreferences} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <label className="flex items-center justify-between gap-3">
            <span>Email notifications</span>
            <select
              name="email_notification_frequency"
              defaultValue={profile?.email_notifications === false ? 'off' : profile?.email_notification_frequency ?? 'immediate'}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value="immediate">Immediately</option>
              <option value="daily">Daily digest</option>
              <option value="weekly">Weekly digest</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="email_article_updates"
              defaultChecked={profile?.email_article_updates !== false}
              className="mt-1"
            />
            <span>Send article approval and moderation updates by email</span>
          </label>
          <p className="text-xs text-stone-400">
            These preferences are ready for production email delivery once an email provider is connected.
          </p>
          <button className="rounded bg-brand px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-dark">Save email preferences</button>
        </form>
      </section>

      {/* AI assistant */}
      <section>
        <h2 className={sectionH}>AI assistant</h2>
        <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <p className="mb-3">The reading assistant shares your favourite genres and recent reads with Google (Gemini) to answer questions and suggest books. You can turn it off completely.</p>
          <form action={setAiEnabled} className="flex items-center justify-between gap-3">
            <span className="font-medium text-stone-700">Assistant</span>
            <span className="flex items-center gap-2">
              <select name="ai_enabled" defaultValue={profile?.ai_enabled === false ? 'off' : 'on'} className="rounded border border-slate-300 px-2 py-1">
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
              <button className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">Save</button>
            </span>
          </form>
        </div>
      </section>

      {/* Data & account */}
      <section>
        <h2 className={sectionH}>Data &amp; account</h2>
        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <p>Download a copy of everything you have created on Reading App.</p>
          <a href="/api/export" className="inline-block rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">Export my data (JSON)</a>
          <div className="border-t border-stone-100 pt-3">
            <p className="mb-2 text-stone-500">Deleting your account permanently removes your profile, shelves, reviews, posts, lists, messages and goals. This cannot be undone.</p>
            <DeleteAccount />
          </div>
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
