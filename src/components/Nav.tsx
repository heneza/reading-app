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

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-[880px] items-center gap-4 px-5 py-3">
        <Link href="/" className="whitespace-nowrap text-lg font-bold text-brand">
          📚 Reading App
        </Link>

        {/* Header search box — submits to the search page */}
        <form action="/search" className="hidden flex-1 sm:block">
          <input
            name="q"
            placeholder="Search books, authors, users…"
            className="w-full rounded-full border border-slate-300 px-4 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-4 text-sm">
          <Link href="/search" className="hover:text-brand">
            Search
          </Link>
          {user ? (
            <>
              {username && (
                <Link href={`/u/${username}`} className="hover:text-brand">
                  Profile
                </Link>
              )}
              <form action={signout}>
                <button className="text-slate-500 hover:text-brand">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="hover:text-brand">
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
