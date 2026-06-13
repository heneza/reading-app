import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';

const STATUS_LABEL: Record<string, string> = {
  want_to_read: 'Want to read',
  reading: 'Reading',
  read: 'Read',
  dnf: 'Did not finish',
};
const STATUS_ORDER = ['reading', 'want_to_read', 'read', 'dnf'];

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-out landing
  if (!user) {
    return (
      <div className="py-10 text-center">
        <h1 className="mb-3 text-3xl font-bold">Track what you read.</h1>
        <p className="mx-auto mb-6 max-w-md text-slate-500">
          A walking-skeleton proof of concept: search a book, shelve it, and
          see it on your profile.
        </p>
        <Link
          href="/login"
          className="inline-block rounded bg-brand px-5 py-2 font-medium text-white hover:opacity-90"
        >
          Get started
        </Link>
      </div>
    );
  }

  // Logged-in: this user's shelf
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .single();

  const { data: entries } = await supabase
    .from('reading_entries')
    .select('status, rating, books ( title, author, cover_id )')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  const list = entries ?? [];
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: list.filter((e: any) => e.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {profile?.display_name ?? 'Your'} shelf
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        @{profile?.username} · {list.length} book
        {list.length === 1 ? '' : 's'}
      </p>

      {list.length === 0 ? (
        <p className="text-slate-500">
          Nothing here yet.{' '}
          <Link href="/search" className="text-brand underline">
            Search for a book
          </Link>{' '}
          to add your first one.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.status}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                {STATUS_LABEL[group.status]} ({group.items.length})
              </h2>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {group.items.map((e: any, i: number) => {
                  const src = coverUrl(e.books?.cover_id, 'M');
                  return (
                    <li key={i} className="flex flex-col">
                      <div className="aspect-[2/3] w-full overflow-hidden rounded bg-slate-100">
                        {src && (
                          <Image
                            src={src}
                            alt={e.books?.title ?? ''}
                            width={200}
                            height={300}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">
                        {e.books?.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {e.books?.author}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
