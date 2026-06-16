import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import PendingButton from '@/components/PendingButton';
import { createClub, joinClub, leaveClub } from '@/app/actions/clubs';

export const dynamic = 'force-dynamic';

type Club = {
  id: string;
  name: string;
  topic: string;
  description: string | null;
  image_url: string | null;
  visibility: 'public' | 'private';
  created_at: string;
};

function safeImage(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function ClubImage({ club }: { club: Club }) {
  const image = safeImage(club.image_url);
  return (
    <div
      className="h-28 rounded-t-lg bg-brand-soft bg-cover bg-center"
      style={image ? { backgroundImage: `linear-gradient(rgba(20,16,15,.1), rgba(20,16,15,.22)), url(${image})` } : undefined}
    />
  );
}

export default async function ClubsPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const q = String(searchParams?.q ?? '').trim();

  let query = supabase
    .from('clubs')
    .select('id, name, topic, description, image_url, visibility, created_at')
    .order('created_at', { ascending: false })
    .limit(48);
  if (q) {
    const needle = q.replace(/[%_]/g, '');
    query = query.or(`name.ilike.%${needle}%,topic.ilike.%${needle}%,description.ilike.%${needle}%`);
  }
  const { data: clubRows } = await query;
  const clubs = (clubRows ?? []) as Club[];
  const clubIds = clubs.map((club) => club.id);

  const [memberRowsRes, myRowsRes] = await Promise.all([
    clubIds.length
      ? supabase
          .from('club_members')
          .select('club_id')
          .in('club_id', clubIds)
          .eq('status', 'active')
      : Promise.resolve({ data: [] as any[] }),
    user && clubIds.length
      ? supabase
          .from('club_members')
          .select('club_id, status')
          .in('club_id', clubIds)
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const countByClub = new Map<string, number>();
  (memberRowsRes.data ?? []).forEach((row: any) => {
    countByClub.set(row.club_id, (countByClub.get(row.club_id) ?? 0) + 1);
  });
  const myStatus = new Map<string, string>();
  (myRowsRes.data ?? []).forEach((row: any) => myStatus.set(row.club_id, row.status));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clubs</h1>
          <p className="mt-1 text-sm text-stone-500">Find a room for a genre, book, author, or mood.</p>
        </div>
        <form className="flex min-w-[16rem] gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search clubs"
            className="min-w-0 flex-1 rounded-full border border-stone-300 px-4 py-2 text-sm focus:border-brand focus:outline-none"
          />
          <button className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:border-brand hover:text-brand">
            Search
          </button>
        </form>
      </header>

      {user && (
        <details className="rounded-lg border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-700">Create club</summary>
          <form action={createClub} className="mt-4 grid gap-3 md:grid-cols-2">
            <input name="name" maxLength={80} required placeholder="Club name" className="rounded border border-stone-300 px-3 py-2 text-sm" />
            <input name="topic" maxLength={60} required placeholder="Genre, book, theme, or author" className="rounded border border-stone-300 px-3 py-2 text-sm" />
            <select name="visibility" className="rounded border border-stone-300 px-3 py-2 text-sm">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <input name="imageUrl" placeholder="Image URL" className="rounded border border-stone-300 px-3 py-2 text-sm" />
            <textarea name="description" maxLength={600} rows={3} placeholder="Description" className="rounded border border-stone-300 px-3 py-2 text-sm md:col-span-2" />
            <PendingButton pendingLabel="Creating..." className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark md:w-fit">
              Create
            </PendingButton>
          </form>
        </details>
      )}

      {clubs.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
          No clubs found.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => {
            const status = myStatus.get(club.id);
            return (
              <article key={club.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                <ClubImage club={club} />
                <div className="space-y-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/clubs/${club.id}`} className="min-w-0 flex-1 truncate text-lg font-semibold hover:text-brand hover:underline">
                        {club.name}
                      </Link>
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                        {club.visibility}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">{club.topic}</p>
                  </div>
                  {club.description && <p className="line-clamp-3 text-sm text-stone-600">{club.description}</p>}
                  <div className="flex items-center justify-between gap-3 text-xs text-stone-400">
                    <span>{countByClub.get(club.id) ?? 0} members</span>
                    {user ? (
                      status === 'active' ? (
                        <form action={leaveClub}>
                          <input type="hidden" name="clubId" value={club.id} />
                          <PendingButton pendingLabel="Leaving..." className="text-brand hover:underline">Leave</PendingButton>
                        </form>
                      ) : status === 'pending' ? (
                        <span className="text-stone-500">Pending</span>
                      ) : (
                        <form action={joinClub}>
                          <input type="hidden" name="clubId" value={club.id} />
                          <PendingButton pendingLabel="Joining..." className="text-brand hover:underline">
                            {club.visibility === 'private' ? 'Request' : 'Join'}
                          </PendingButton>
                        </form>
                      )
                    ) : (
                      <Link href={`/login?next=/clubs/${club.id}`} className="text-brand hover:underline">Join</Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
