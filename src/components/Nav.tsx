import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { signout } from '@/app/login/actions';

export default async function Nav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-[880px] items-center justify-between px-5 py-3">
        <Link href="/" className="text-lg font-bold text-brand">
          📚 Reading App
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/search" className="hover:text-brand">
            Search
          </Link>
          {user ? (
            <form action={signout}>
              <button className="text-slate-500 hover:text-brand">
                Sign out
              </button>
            </form>
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
