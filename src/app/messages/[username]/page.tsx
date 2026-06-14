import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import MessageComposer from './MessageComposer';
import MessageList from './MessageList';
import Avatar from '@/components/Avatar';

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
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-stone-200 bg-white p-4">
        <MessageList
          messages={messages}
          meId={user.id}
          showSeen={other.read_receipts !== false}
        />
      </div>

      <div className="mt-3">
        <MessageComposer recipientId={other.id} />
      </div>
    </div>
  );
}
