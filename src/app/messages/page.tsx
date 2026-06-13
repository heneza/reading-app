import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export default async function InboxPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: msgs } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(300);

  // Reduce to one row per conversation partner (latest message), plus unread.
  type Convo = {
    otherId: string;
    last: any;
    unread: number;
  };
  const byOther = new Map<string, Convo>();
  for (const m of msgs ?? []) {
    const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    const existing = byOther.get(otherId);
    const isUnread = m.recipient_id === user.id && !m.read_at;
    if (!existing) {
      byOther.set(otherId, { otherId, last: m, unread: isUnread ? 1 : 0 });
    } else if (isUnread) {
      existing.unread += 1;
    }
  }
  const convos = Array.from(byOther.values());

  // Look up the other participants' names.
  const nameById = new Map<string, { username: string; display: string | null }>();
  if (convos.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', convos.map((c) => c.otherId));
    (profs ?? []).forEach((p: any) =>
      nameById.set(p.id, { username: p.username, display: p.display_name })
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold">Messages</h1>

      {convos.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
          No messages yet. Open someone&apos;s profile and hit{' '}
          <span className="font-medium">Message</span> to start a conversation.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {convos.map((c) => {
            const who = nameById.get(c.otherId);
            const mineLast = c.last.sender_id === user.id;
            return (
              <li key={c.otherId}>
                <Link
                  href={`/messages/${who?.username ?? ''}`}
                  className="flex items-center gap-3 p-4 hover:bg-brand-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {who?.display ?? `@${who?.username ?? 'user'}`}
                      {c.unread > 0 && (
                        <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-white">
                          {c.unread}
                        </span>
                      )}
                    </p>
                    <p className={`truncate text-sm ${c.unread > 0 ? 'font-medium text-stone-800' : 'text-stone-500'}`}>
                      {mineLast ? 'You: ' : ''}
                      {c.last.body}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs text-stone-400">
                    {timeAgo(c.last.created_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
