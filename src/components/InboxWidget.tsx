'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { sendMessage } from '@/app/actions/messages';
import Avatar from '@/components/Avatar';
import type { MessageSidebarItem } from '@/lib/message-sidebar';

type Msg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  read_at: string | null;
};

function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function previewFor(item: MessageSidebarItem) {
  if (!item.lastBody) return 'No messages yet';
  return `${item.lastMine ? 'You: ' : ''}${item.lastBody}`;
}

function totalUnread(items: MessageSidebarItem[]) {
  return items.reduce((sum, item) => sum + item.unread, 0);
}

function sortItems(items: MessageSidebarItem[]) {
  return [...items].sort((a, b) => {
    if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
    if (a.lastAt || b.lastAt) {
      if (!a.lastAt) return 1;
      if (!b.lastAt) return -1;
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    }
    return (a.displayName ?? a.username).localeCompare(b.displayName ?? b.username);
  });
}

export default function InboxWidget({
  meId,
  initialItems,
}: {
  meId: string;
  initialItems: MessageSidebarItem[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(() => sortItems(initialItems));
  const [active, setActive] = useState<MessageSidebarItem | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState('');
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const supabase = useMemo(() => createClient(), []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const activeRef = useRef<MessageSidebarItem | null>(null);
  const openRef = useRef(open);
  const itemsRef = useRef(items);

  const unread = useMemo(() => totalUnread(items), [items]);

  useEffect(() => {
    activeRef.current = active;
    if (typeof window !== 'undefined') {
      if (active) {
        (window as any).__readingAppActiveInbox = { id: active.id, username: active.username };
      } else {
        delete (window as any).__readingAppActiveInbox;
      }
    }
    return () => {
      if (typeof window !== 'undefined') delete (window as any).__readingAppActiveInbox;
    };
  }, [active]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typing, open]);

  const markRead = useCallback(async (otherId: string) => {
    const now = new Date().toISOString();
    await supabase
      .from('messages')
      .update({ read_at: now })
      .eq('recipient_id', meId)
      .eq('sender_id', otherId)
      .is('read_at', null);

    setItems((prev) =>
      sortItems(prev.map((item) => (item.id === otherId ? { ...item, unread: 0 } : item)))
    );
  }, [meId, supabase]);

  const loadMessages = useCallback(async (other: MessageSidebarItem) => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, created_at, edited_at, read_at')
      .or(
        `and(sender_id.eq.${meId},recipient_id.eq.${other.id}),` +
          `and(sender_id.eq.${other.id},recipient_id.eq.${meId})`
      )
      .order('created_at', { ascending: true })
      .limit(120);

    if (loadError) {
      setError('Could not load messages.');
    } else {
      setMessages((data ?? []) as Msg[]);
      await markRead(other.id);
    }
    setLoading(false);
  }, [markRead, meId, supabase]);

  function closePanel() {
    setOpen(false);
    setActive(null);
    setMessages([]);
    setBody('');
    setTyping(false);
    setError(null);
  }

  function openConversation(item: MessageSidebarItem) {
    setActive(item);
    setOpen(true);
    void loadMessages(item);
  }

  useEffect(() => {
    const ch = supabase.channel('inbox-widget-global');

    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${meId}` },
      async (payload: any) => {
        const msg = payload.new as Msg | undefined;
        if (!msg || msg.sender_id === meId) return;

        const current = activeRef.current;
        const isActive = current?.id === msg.sender_id && openRef.current;
        const existingItem = itemsRef.current.find((item) => item.id === msg.sender_id);

        let senderProfile: {
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          read_receipts: boolean | null;
        } | null = null;
        if (!existingItem) {
          const { data } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url, read_receipts')
            .eq('id', msg.sender_id)
            .maybeSingle();
          senderProfile = data ?? null;
        }
        const senderUsername = existingItem?.username ?? senderProfile?.username ?? null;
        const isOpenThread =
          typeof window !== 'undefined' &&
          senderUsername != null &&
          window.location.pathname === `/messages/${senderUsername}`;
        const shouldMarkRead = isActive || isOpenThread;

        setItems((prev) => {
          const existing = prev.find((item) => item.id === msg.sender_id);
          const nextItem: MessageSidebarItem =
            existing ?? {
              id: msg.sender_id,
              username: senderProfile?.username ?? 'reader',
              displayName: senderProfile?.display_name ?? null,
              avatarUrl: senderProfile?.avatar_url ?? null,
              relation: 'conversation',
              lastBody: null,
              lastAt: null,
              lastMine: false,
              lastReadAt: null,
              showSeen: senderProfile?.read_receipts !== false,
              unread: 0,
              hasMessages: true,
            };
          const updated = {
            ...nextItem,
            lastBody: msg.body,
            lastAt: msg.created_at,
            lastMine: false,
            unread: shouldMarkRead ? 0 : nextItem.unread + 1,
            hasMessages: true,
          };
          return sortItems([updated, ...prev.filter((item) => item.id !== msg.sender_id)]);
        });

        if (isActive) {
          setMessages((prev) => (prev.some((item) => item.id === msg.id) ? prev : [...prev, msg]));
          setTyping(false);
        }
        if (shouldMarkRead) await markRead(msg.sender_id);
      }
    );

    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `recipient_id=eq.${meId}` },
      (payload: any) => {
        const msg = payload.new as Msg | undefined;
        if (!msg?.sender_id || !msg.read_at) return;
        setItems((prev) =>
          sortItems(prev.map((item) => (item.id === msg.sender_id ? { ...item, unread: 0 } : item)))
        );
      }
    );

    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [markRead, meId, supabase]);

  useEffect(() => {
    const current = active;
    if (!current) return;

    const topic = `dm:${[meId, current.id].sort().join(':')}`;
    const ch = supabase.channel(topic, { config: { broadcast: { self: false } } });

    ch.on('broadcast', { event: 'typing' }, () => {
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3500);
    });

    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${meId}` },
      (payload: any) => {
        const msg = payload.new as Msg | undefined;
        if (!msg || msg.recipient_id !== current.id) return;
        setMessages((prev) =>
          prev.map((item) => (item.id === msg.id ? { ...item, read_at: msg.read_at } : item))
        );
      }
    );

    ch.subscribe();
    typingChannelRef.current = ch;
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [active, meId, supabase]);

  async function refreshActiveMessages() {
    if (!active) return;
    await loadMessages(active);
  }

  function onType(value: string) {
    setBody(value);
    const now = Date.now();
    if (now - lastTypingSent.current > 1200 && typingChannelRef.current) {
      lastTypingSent.current = now;
      typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: {} });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    const text = body.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const res = await sendMessage(active.id, text);
      if (res.error) {
        setError(res.error);
        return;
      }
      setBody('');
      setItems((prev) =>
        sortItems(
          prev.map((item) =>
            item.id === active.id
              ? { ...item, lastBody: text, lastMine: true, lastAt: new Date().toISOString(), hasMessages: true }
              : item
          )
        )
      );
      await refreshActiveMessages();
    });
  }

  let seenAfterId: string | null = null;
  if (active?.showSeen) {
    for (const message of messages) {
      if (message.sender_id === meId && message.read_at) seenAfterId = message.id;
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 left-5 z-40 flex h-[30rem] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2.5">
            {active ? (
              <div className="flex min-w-0 items-center gap-2">
                <Avatar src={active.avatarUrl} name={active.displayName ?? active.username} size={28} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-700">{active.displayName ?? `@${active.username}`}</p>
                  <Link href={`/messages/${active.username}`} className="text-xs text-brand hover:underline">
                    Open inbox
                  </Link>
                </div>
              </div>
            ) : (
              <span className="text-sm font-semibold text-stone-700">Inbox</span>
            )}
            <button onClick={closePanel} aria-label="Close inbox" className="rounded-full px-2 text-stone-400 hover:text-brand">×</button>
          </div>

          {active ? (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {loading && <p className="text-sm text-stone-400">Loading messages...</p>}
                {!loading && messages.length === 0 && !typing && (
                  <p className="text-sm text-stone-400">No messages yet.</p>
                )}
                {messages.map((message) => {
                  const mine = message.sender_id === meId;
                  return (
                    <div key={message.id} className={`group flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                        <span
                          className={`inline-block max-w-[16rem] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-sm ${
                            mine ? 'bg-brand text-white' : 'border border-stone-200 bg-stone-50 text-stone-700'
                          }`}
                        >
                          {message.body}
                        </span>
                        <span className="invisible whitespace-nowrap text-[11px] text-stone-400 group-hover:visible">
                          {shortTime(message.created_at)}
                        </span>
                      </div>
                      {mine && seenAfterId === message.id && (
                        <span className="mt-0.5 text-[11px] text-stone-400">Seen</span>
                      )}
                    </div>
                  );
                })}
                {typing && (
                  <div className="flex items-start">
                    <span className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm italic text-stone-400">
                      @{active.username} is typing...
                    </span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={submit} className="border-t border-stone-200 p-2">
                {error && <p className="mb-2 px-2 text-sm text-red-700">{error}</p>}
                <div className="flex gap-2">
                  <input
                    value={body}
                    onChange={(e) => onType(e.target.value)}
                    placeholder="Write a message..."
                    className="min-w-0 flex-1 rounded-full border border-stone-300 px-4 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={pending || !body.trim()}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
                  >
                    {pending ? '...' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-2">
              {items.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-stone-400">No chats yet.</p>
              ) : (
                <ul className="space-y-1">
                  {items.slice(0, 12).map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => openConversation(item)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-stone-50"
                      >
                        <Avatar src={item.avatarUrl} name={item.displayName ?? item.username} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-stone-700">
                            {item.displayName ?? `@${item.username}`}
                          </span>
                          <span className="block truncate text-xs text-stone-500">{previewFor(item)}</span>
                        </span>
                        {item.unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
                            {item.unread}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/messages" className="mt-2 block rounded-lg px-2 py-2 text-center text-sm font-medium text-brand hover:bg-brand-soft">
                Open full inbox
              </Link>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => {
          setOpen((value) => !value);
          if (open) {
            setActive(null);
            setMessages([]);
          }
        }}
        aria-label="Open inbox"
        className="fixed bottom-5 left-5 z-40 flex h-12 items-center gap-2 rounded-full bg-stone-800 px-4 font-medium text-white shadow-card transition hover:bg-brand"
      >
        <span className="relative">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {unread > 0 && (
            <span className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
              {unread}
            </span>
          )}
        </span>
        <span className="hidden sm:inline">Inbox</span>
      </button>
    </>
  );
}
