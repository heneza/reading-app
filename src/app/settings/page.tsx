import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { requestPasswordReset, signout } from '@/app/login/actions';
import { setVisibility } from '@/app/actions/profile';
import { setAiEnabled, setEmailPreferences } from '@/app/actions/account';
import { unblockUser } from '@/app/actions/blocks';
import Avatar from '@/components/Avatar';
import DeleteAccount from './DeleteAccount';
import SetPasswordForm from './SetPasswordForm';
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
  const { data: blockedRows } = await supabase
    .from('blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });
  const blockedIds = (blockedRows ?? []).map((row: any) => row.blocked_id);
  const { data: blockedProfiles } = blockedIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', blockedIds)
    : { data: [] as any[] };
  const blockedById = new Map((blockedProfiles ?? []).map((blocked: any) => [blocked.id, blocked]));

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
        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-sm">
          <p>
            <span className="text-stone-500">Username:</span> @{profile?.username}
          </p>
          <p>
            <span className="text-stone-500">Email:</span> {user.email}
          </p>
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            <Link
              href="/settings/activity"
              className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              My activity
            </Link>
            <Link
              href="/settings/profile"
              className="rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Edit profile
            </Link>
            <form action={signout}>
              <button className="rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Appearance */}
      {profile?.is_admin && (
        <section>
          <h2 className={sectionH}>Admin</h2>
          <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
            <Link href="/settings/moderation" className="font-medium text-brand hover:underline">
              Moderation queue →
            </Link>
            <p className="mt-1 text-stone-500">Review reported posts, club posts, profiles, and lists.</p>
          </div>
        </section>
      )}

      {/* Appearance */}
      <section>
        <h2 className={sectionH}>Appearance</h2>
        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <p>Choose how Reading App looks on this device.</p>
          <ThemeToggle />
        </div>
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

          <SetPasswordForm />

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
            <label className="flex items-center justify-between gap-3">
              <span>Who can see your diary</span>
              <select name="diary_visibility" defaultValue={profile?.diary_visibility ?? 'public'}>
                <option value="public">Everyone</option>
                <option value="friends">Friends only</option>
                <option value="private">Only me</option>
              </select>
            </label>
            <button className="rounded bg-brand px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-dark">Save visibility</button>
          </form>

          <div className="border-t border-stone-100 pt-3">
            <h3 className="font-medium text-stone-700">Blocked users</h3>
            {blockedRows?.length ? (
              <ul className="mt-3 space-y-2">
                {blockedRows.map((row: any) => {
                  const blocked = blockedById.get(row.blocked_id);
                  if (!blocked) return null;
                  return (
                    <li key={row.blocked_id} className="flex items-center justify-between gap-3 rounded border border-stone-200 p-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar src={blocked.avatar_url} name={blocked.display_name ?? blocked.username} size={32} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-stone-700">{blocked.display_name ?? blocked.username}</p>
                          <p className="truncate text-xs text-stone-400">@{blocked.username}</p>
                        </div>
                      </div>
                      <form action={unblockUser}>
                        <input type="hidden" name="blockedId" value={row.blocked_id} />
                        <input type="hidden" name="username" value={blocked.username} />
                        <button className="rounded border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:border-brand hover:text-brand">
                          Unblock
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-500">No blocked users.</p>
            )}
          </div>
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

      {/* Import & data */}
      <section>
        <h2 className={sectionH}>Import &amp; data</h2>
        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <div>
            <Link href="/settings/import" className="font-medium text-brand hover:underline">
              Import from Goodreads, StoryGraph or Hardcover →
            </Link>
            <p className="mt-1 text-stone-500">
              Bring your shelves, ratings and reviews over from a CSV or JSON export.
            </p>
          </div>
          <div className="border-t border-stone-100 pt-3">
            <p className="mb-2 text-stone-500">Download a copy of everything you have created on Reading App.</p>
            <a href="/api/export" className="inline-block rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
              Export my data (JSON)
            </a>
          </div>
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
