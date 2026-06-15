import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { signout } from '@/app/login/actions';
import Avatar from '@/components/Avatar';
import SearchSuggestBox from '@/components/SearchSuggestBox';
import PendingButton from '@/components/PendingButton';
import NotificationBell from '@/components/NotificationBell';

type ViewerProfile = {
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
};

export default async function Nav({
  viewerId,
  profile,
}: {
  viewerId?: string | null;
  profile?: ViewerProfile | null;
}) {
  let username = profile?.username ?? null;
  let avatarUrl = profile?.avatar_url ?? null;
  let displayName = profile?.display_name ?? null;
  let unread = 0;
  let notifUnread = 0;
  if (viewerId) {
    const supabase = createClient();
    // Independent lookups — run together instead of three sequential round-trips.
    const [pRes, unreadRes, notifRes] = await Promise.all([
      profile
        ? Promise.resolve({ data: profile })
        : supabase.from('profiles').select('username, avatar_url, display_name').eq('id', viewerId).maybeSingle(),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('recipient_id', viewerId).is('read_at', null),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', viewerId).eq('read', false),
    ]);
    username = pRes.data?.username ?? null;
    avatarUrl = pRes.data?.avatar_url ?? null;
    displayName = pRes.data?.display_name ?? null;
    unread = unreadRes.count ?? 0;
    notifUnread = notifRes.count ?? 0;
  }

  const item =
    'block px-4 py-2 text-sm text-slate-600 transition hover:bg-brand-soft hover:text-brand';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-[880px] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5">
        <Link href="/" className="flex-shrink-0 whitespace-nowrap text-base font-bold text-brand sm:text-lg">
          Reading App
        </Link>

        <SearchSuggestBox
          className="hidden flex-1 sm:block"
          inputClassName="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm transition focus:border-brand focus:bg-white focus:outline-none"
          placeholder="Search books, authors, users..."
        />

        <div className="ml-auto flex min-w-0 items-center gap-1 text-sm sm:gap-2">
          {viewerId && (
            <NotificationBell unread={notifUnread} />
          )}
          <Link
            href="/lists"
            className="hidden rounded-full px-2.5 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand min-[360px]:inline-flex sm:px-3"
          >
            Lists
          </Link>
          <Link
            href="/articles"
            className="hidden rounded-full px-3 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand sm:inline-flex"
          >
            Articles
          </Link>
          {viewerId ? (
            /* Profile menu (reveals on hover) */
            <div className="group relative">
              <Link
                href={username ? `/u/${username}` : '/settings'}
                className="flex items-center gap-2 rounded-full px-2 py-1.5 text-slate-600 transition hover:bg-brand-soft"
              >
                <span className="relative">
                  <Avatar src={avatarUrl} name={displayName ?? username ?? 'you'} size={28} />
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                      {unread}
                    </span>
                  )}
                </span>
                <span className="hidden sm:inline">Profile</span>
              </Link>

              {/* Dropdown — the pt-2 keeps hover alive across the gap */}
              <div className="invisible absolute right-0 top-full z-30 w-48 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                <div className="overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-card">
                  {username && (
                    <Link href={`/u/${username}`} className={item}>
                      View profile
                    </Link>
                  )}
                  <Link href="/messages" className={`flex items-center justify-between ${item}`}>
                    Inbox
                    {unread > 0 && (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-white">
                        {unread}
                      </span>
                    )}
                  </Link>
                  <Link href="/goals" className={item}>
                    Reading goals
                  </Link>
                  <Link href="/quotes" className={item}>
                    Quotes
                  </Link>
                  <Link href="/settings" className={item}>
                    Settings
                  </Link>
                  <form action={signout}>
                    <PendingButton pendingLabel="Signing out..." className={`w-full text-left ${item}`}>Sign out</PendingButton>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Link
                href="/search"
                className="rounded-full px-2.5 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand sm:px-3"
              >
                Search
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-brand px-3 py-1.5 font-medium text-white transition hover:bg-brand-dark sm:px-4"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
