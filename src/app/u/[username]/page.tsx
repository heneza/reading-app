import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';

const STATUS_LABEL: Record<string, string> = {
  want_to_read: 'Want to read',
  reading: 'Reading',
  read: 'Read',
  dnf: 'Did not finish',
};
const STATUS_ORDER = ['reading', 'want_to_read', 'read', 'dnf'];

export default async function ProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const supabase = createClient();

  // Find the profile by username.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio')
    .eq('username', params.username)
    .maybeSingle();

  if (!profile) notFound();

  // Their shelf (public, thanks to the new RLS policy).
  const { data: entries } = await supabase
    .from('reading_entries')
    .select('status, rating, book_id, books ( title, author, cover_id )')
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false });

  const list = entries ?? [];
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: list.filter((e: any) => e.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {profile.display_name ?? profile.username}
      </h1>
      <p className="text-sm text-slate-500">
        @{profile.username} · {list.length} book{list.length === 1 ? '' : 's'}
      </p>
      {profile.bio && <p className="mt-2 text-slate-700">{profile.bio}</p>}

      {list.length === 0 ? (
        <p className="mt-6 text-slate-500">No books on this shelf yet.</p>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.map((group) => (
            <section key={group.status}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                {STATUS_LABEL[group.status]} ({group.items.length})
              </h2>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {group.items.map((e: any, i: number) => {
                  const src = coverUrl(e.books?.cover_id, 'M');
                  return (
                    <li key={i}>
                      <Link href={`/book/${e.book_id}`} className="group flex flex-col">
                        <div className="aspect-[2/3] w-full overflow-hidden rounded bg-slate-100 group-hover:opacity-90">
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
                          {e.rating ? ` · ${Number(e.rating).toFixed(1)}★` : ''}
                        </p>
                      </Link>
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
