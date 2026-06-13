import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { signout } from '@/app/login/actions';

export default async function Nav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (user) {
    const { data: p } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();
    username = p?.username ?? null;
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

  const pill =
    'rounded-full px-3 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-[880px] items-center gap-3 px-5 py-3">
        <Link href="/" className="whitespace-nowrap text-lg font-bold text-brand">
          Reading App
        </Link>

        {/* Header search box — submits to the search page */}
        <form action="/search" className="hidden flex-1 sm:block">
          <input
            name="q"
            placeholder="Search books, authors, users…"
            className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm transition focus:border-brand focus:bg-white focus:outline-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/search" className={pill}>
            Search
          </Link>
          {user ? (
            <>
              <Link href="/messages" className={`relative ${pill}`}>
                Messages
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </Link>
              {username && (
                <Link href={`/u/${username}`} className={pill}>
                  Profile
                </Link>
              )}
              <form action={signout}>
                <button className={pill}>Sign out</button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-brand px-4 py-1.5 font-medium text-white transition hover:bg-brand-dark"
            >
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
