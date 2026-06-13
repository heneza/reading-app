import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import MessageComposer from './MessageComposer';

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

  // Who am I talking to?
  const { data: other } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('username', params.username)
    .maybeSingle();
  if (!other) notFound();

  if (other.id === user.id) redirect('/messages');

  // Mark their messages to me as read (best effort).
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id)
    .eq('sender_id', other.id)
    .is('read_at', null);

  // The conversation, oldest first.
  const { data: msgs } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at')
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${other.id}),` +
        `and(sender_id.eq.${other.id},recipient_id.eq.${user.id})`
    )
    .order('created_at', { ascending: true })
    .limit(500);

  const messages = msgs ?? [];

  return (
    <div className="mx-auto flex h-[70vh] max-w-lg flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Link href="/messages" className="text-sm text-stone-400 hover:text-brand">
          ← Inbox
        </Link>
        <Link
          href={`/u/${other.username}`}
          className="ml-1 font-semibold hover:text-brand hover:underline"
        >
          {other.display_name ?? `@${other.username}`}
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-stone-200 bg-white p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-stone-400">
            No messages yet — say hello.
          </p>
        ) : (
          messages.map((m: any) => {
            const mine = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <p
                  className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? 'bg-brand text-white'
                      : 'border border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  {m.body}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="mt-3">
        <MessageComposer recipientId={other.id} />
      </div>
    </div>
  );
}
