import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { signout } from '@/app/login/actions';
import Avatar from '@/components/Avatar';

export default async function Nav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  let avatarUrl: string | null = null;
  let displayName: string | null = null;
  if (user) {
    const { data: p } = await supabase
      .from('profiles')
      .select('username, avatar_url, display_name')
      .eq('id', user.id)
      .maybeSingle();
    username = p?.username ?? null;
    avatarUrl = p?.avatar_url ?? null;
    displayName = p?.display_name ?? null;
  }

  let unread = 0;
  if (user) {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null);
    unread = count ?? 0;
  }

  let notifUnread = 0;
  if (user) {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);
    notifUnread = count ?? 0;
  }

  const item =
    'block px-4 py-2 text-sm text-slate-600 transition hover:bg-brand-soft hover:text-brand';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-[880px] items-center gap-3 px-5 py-3">
        <Link href="/" className="whitespace-nowrap text-lg font-bold text-brand">
          Reading App
        </Link>

        {/* Search box */}
        <form action="/search" className="hidden flex-1 sm:block">
          <input
            name="q"
            placeholder="Search books, authors, users…"
            className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm transition focus:border-brand focus:bg-white focus:outline-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-2 text-sm">
          {user && (
            <Link href="/notifications" title="Notifications" className="relative rounded-full px-2 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              {notifUnread > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{notifUnread}</span>
              )}
            </Link>
          )}
          <Link
            href="/articles"
            className="rounded-full px-3 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand"
          >
            Articles
          </Link>
          {user ? (
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
                  <Link href="/settings" className={item}>
                    Settings
                  </Link>
                  <form action={signout}>
                    <button className={`w-full text-left ${item}`}>Sign out</button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Link
                href="/search"
                className="rounded-full px-3 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand"
              >
                Search
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-brand px-4 py-1.5 font-medium text-white transition hover:bg-brand-dark"
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
