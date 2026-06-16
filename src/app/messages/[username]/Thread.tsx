'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { sendMessage, editMessage, deleteMessage } from '@/app/actions/messages';

type Msg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  read_at: string | null;
};

function fullTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function Thread({
  initialMessages,
  meId,
  otherId,
  otherUsername,
  showSeen,
}: {
  initialMessages: Msg[];
  meId: string;
  otherId: string;
  otherUsername: string;
  showSeen: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>(initialMessages);
  const [typing, setTyping] = useState(false);
  const [body, setBody] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const topic = `dm:${[meId, otherId].sort().join(':')}`;

  // Keep in sync with fresh server data (after edit/delete refresh).
  useEffect(() => setMsgs(initialMessages), [initialMessages]);

  // One realtime channel: incoming messages + typing broadcast (both ways).
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(topic, { config: { broadcast: { self: false } } });
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${otherId}` },
      (payload: any) => {
        const m = payload.new;
        if (!m || m.recipient_id !== meId) return;
        setMsgs((prev) =>
          prev.some((x) => x.id === m.id)
            ? prev
            : [...prev, { id: m.id, sender_id: m.sender_id, body: m.body, created_at: m.created_at, edited_at: m.edited_at ?? null, read_at: m.read_at ?? null }]
        );
        setTyping(false);
        void supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('id', m.id)
          .eq('recipient_id', meId)
          .is('read_at', null);
      }
    );
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${meId}` },
      (payload: any) => {
        const m = payload.new;
        if (!m || m.recipient_id !== otherId) return;
        setMsgs((prev) =>
          prev.map((item) => (item.id === m.id ? { ...item, read_at: m.read_at ?? null } : item))
        );
      }
    );
    ch.on('broadcast', { event: 'typing' }, () => {
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3500);
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [topic, meId, otherId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length, typing]);

  function onType(v: string) {
    setBody(v);
    const now = Date.now();
    if (now - lastTypingSent.current > 1200 && channelRef.current) {
      lastTypingSent.current = now;
      channelRef.current.send({ type: 'broadcast', event: 'typing', payload: {} });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const res = await sendMessage(otherId, text);
      if (res.error) {
        setError(res.error);
        return;
      }
      setBody('');
      router.refresh();
    });
  }

  function saveEdit(id: string) {
    const text = draft.trim();
    if (!text) return;
    startTransition(async () => {
      const res = await editMessage(id, text);
      if (!res.error) {
        setEditId(null);
        router.refresh();
      }
    });
  }
  function del(id: string) {
    if (!window.confirm('Delete this message?')) return;
    setOpenId(null);
    startTransition(async () => {
      const res = await deleteMessage(id);
      if (!res.error) router.refresh();
    });
  }

  let seenAfterId: string | null = null;
  if (showSeen) for (const m of msgs) if (m.sender_id === meId && m.read_at) seenAfterId = m.id;

  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-stone-200 bg-white p-4">
        {msgs.length === 0 && !typing && <p className="text-sm text-stone-400">No messages yet — say hello.</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === meId;
          const editing = editId === m.id;
          return (
            <div key={m.id} className={`group flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {editing ? (
                <div className="flex w-full items-center justify-end gap-2">
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1 rounded-full border border-stone-300 px-3 py-1 text-sm" />
                  <button onClick={() => saveEdit(m.id)} disabled={pending} className="text-xs font-medium text-brand">Save</button>
                  <button onClick={() => setEditId(null)} className="text-xs text-stone-400">Cancel</button>
                </div>
              ) : (
                <div className={`flex items-center gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  <button
                    type="button"
                    title={fullTime(m.created_at)}
                    onClick={() => mine && setOpenId(openId === m.id ? null : m.id)}
                    className={`max-w-[16rem] whitespace-pre-wrap rounded-2xl px-4 py-2 text-left text-sm ${mine ? 'cursor-pointer bg-brand text-white' : 'cursor-default border border-stone-200 bg-stone-50 text-stone-700'}`}
                  >
                    {m.body}
                    {m.edited_at && <span className={`ml-1 text-[10px] ${mine ? 'text-white/70' : 'text-stone-400'}`}>(edited)</span>}
                  </button>
                  <span className="invisible whitespace-nowrap text-[11px] text-stone-400 group-hover:visible">{shortTime(m.created_at)}</span>
                </div>
              )}
              {mine && openId === m.id && !editing && (
                <div className="mt-1 flex gap-3 text-xs">
                  <button onClick={() => { setEditId(m.id); setDraft(m.body); setOpenId(null); }} className="text-brand hover:underline">Edit</button>
                  <button onClick={() => del(m.id)} disabled={pending} className="text-red-600 hover:underline">Delete</button>
                </div>
              )}
              {mine && seenAfterId === m.id && <span className="mt-0.5 text-[11px] text-stone-400">Seen</span>}
            </div>
          );
        })}

        {typing && (
          <div className="flex items-start">
            <span className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm italic text-stone-400">@{otherUsername} is typing…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3">
        <form onSubmit={submit} className="flex flex-col gap-2">
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => onType(e.target.value)}
              placeholder="Write a message…"
              className="flex-1 rounded-full border border-stone-300 px-4 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <button type="submit" disabled={pending} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
              {pending ? '…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
