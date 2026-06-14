'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { editMessage, deleteMessage } from '@/app/actions/messages';

type Msg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  read_at: string | null;
};

function fullTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MessageList({
  messages,
  meId,
  showSeen,
}: {
  messages: Msg[];
  meId: string;
  showSeen: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // last of my messages the other person has read -> show "Seen" under it
  let seenAfterId: string | null = null;
  if (showSeen) {
    for (const m of messages) if (m.sender_id === meId && m.read_at) seenAfterId = m.id;
  }

  function startEdit(m: Msg) {
    setEditId(m.id);
    setDraft(m.body);
    setOpenId(null);
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

  if (messages.length === 0) {
    return <p className="text-sm text-stone-400">No messages yet — say hello.</p>;
  }

  return (
    <>
      {messages.map((m) => {
        const mine = m.sender_id === meId;
        const editing = editId === m.id;
        return (
          <div key={m.id} className={`group flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
            {editing ? (
              <div className="flex w-full items-center justify-end gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="flex-1 rounded-full border border-stone-300 px-3 py-1 text-sm"
                />
                <button onClick={() => saveEdit(m.id)} disabled={pending} className="text-xs font-medium text-brand">
                  Save
                </button>
                <button onClick={() => setEditId(null)} className="text-xs text-stone-400">
                  Cancel
                </button>
              </div>
            ) : (
              <div className={`flex items-center gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                <button
                  type="button"
                  title={fullTime(m.created_at)}
                  onClick={() => mine && setOpenId(openId === m.id ? null : m.id)}
                  className={`max-w-[16rem] whitespace-pre-wrap rounded-2xl px-4 py-2 text-left text-sm ${
                    mine ? 'cursor-pointer bg-brand text-white' : 'cursor-default border border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  {m.body}
                  {m.edited_at && (
                    <span className={`ml-1 text-[10px] ${mine ? 'text-white/70' : 'text-stone-400'}`}>(edited)</span>
                  )}
                </button>
                <span className="invisible whitespace-nowrap text-[11px] text-stone-400 group-hover:visible">
                  {shortTime(m.created_at)}
                </span>
              </div>
            )}

            {mine && openId === m.id && !editing && (
              <div className="mt-1 flex gap-3 text-xs">
                <button onClick={() => startEdit(m)} className="text-brand hover:underline">
                  Edit
                </button>
                <button onClick={() => del(m.id)} disabled={pending} className="text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            )}

            {mine && seenAfterId === m.id && (
              <span className="mt-0.5 text-[11px] text-stone-400">Seen</span>
            )}
          </div>
        );
      })}
    </>
  );
}
