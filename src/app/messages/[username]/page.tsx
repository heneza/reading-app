import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import Thread from './Thread';
import Avatar from '@/components/Avatar';
import { blockUser, unblockUser } from '@/app/actions/blocks';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({
  params,
}: {
  params: { username: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: other } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, read_receipts')
    .eq('username', params.username)
    .maybeSingle();
  if (!other) notFound();
  if (other.id === user.id) redirect('/messages');

  const { data: blockRow } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', user.id)
    .eq('blocked_id', other.id)
    .maybeSingle();
  const isBlocked = !!blockRow;

  // Opening a thread always clears my own unread count.
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id)
    .eq('sender_id', other.id)
    .is('read_at', null);

  const { data: msgs } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at, edited_at, read_at')
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${other.id}),` +
        `and(sender_id.eq.${other.id},recipient_id.eq.${user.id})`
    )
    .order('created_at', { ascending: true })
    .limit(500);

  const messages = msgs ?? [];

  return (
    <div className="mx-auto flex h-[70vh] max-w-lg flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/messages" className="text-sm text-stone-400 hover:text-brand">
          ← Inbox
        </Link>
        <Avatar src={other.avatar_url} name={other.display_name ?? other.username} size={28} />
        <Link
          href={`/u/${other.username}`}
          className="ml-1 font-semibold hover:text-brand hover:underline"
        >
          {other.display_name ?? `@${other.username}`}
        </Link>

        <details className="relative ml-auto">
          <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-brand">⋯</summary>
          <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-card">
            <form action={isBlocked ? unblockUser : blockUser}>
              <input type="hidden" name="blockedId" value={other.id} />
              <input type="hidden" name="username" value={other.username} />
              <button className="block w-full px-3 py-1.5 text-left text-sm text-stone-600 hover:bg-brand-soft hover:text-red-600">{isBlocked ? 'Unblock user' : 'Block user'}</button>
            </form>
          </div>
        </details>
      </div>

      {isBlocked && (
        <p className="mb-3 rounded-lg border border-stone-200 bg-stone-50 p-2 text-center text-xs text-stone-500">
          You’ve blocked @{other.username}. They can’t message you, and you can’t message them.
        </p>
      )}

      <Thread
        initialMessages={messages}
        meId={user.id}
        otherId={other.id}
        otherUsername={other.username}
        showSeen={other.read_receipts !== false}
      />
    </div>
  );
}
