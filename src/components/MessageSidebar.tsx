'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import type { MessageSidebarItem } from '@/lib/message-sidebar';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

function previewFor(item: MessageSidebarItem): string {
  if (!item.lastBody) return 'No messages yet';
  return `${item.lastMine ? 'You: ' : ''}${item.lastBody}`;
}

export default function MessageSidebar({
  items,
  activeUsername,
}: {
  items: MessageSidebarItem[];
  activeUsername?: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const label = `${item.displayName ?? ''} ${item.username}`.toLowerCase();
      return label.includes(needle);
    });
  }, [items, query]);

  return (
    <aside className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-3">
        <label htmlFor="message-search" className="sr-only">
          Search people to message
        </label>
        <input
          id="message-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search follows"
          className="w-full rounded-full border border-stone-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="p-4 text-sm text-stone-500">
          {items.length === 0 ? 'Follow someone to start a chat.' : 'No matches.'}
        </p>
      ) : (
        <nav className="max-h-[32rem] overflow-y-auto p-2 md:max-h-[70vh]" aria-label="Messages">
          {filtered.map((item) => {
            const active = item.username === activeUsername;
            const name = item.displayName ?? `@${item.username}`;
            const status =
              item.lastMine && item.lastBody ? (item.lastReadAt && item.showSeen ? 'Seen' : 'Sent') : null;

            return (
              <Link
                key={item.id}
                href={`/messages/${item.username}`}
                className={`mb-1 flex items-center gap-3 rounded-lg p-2.5 transition last:mb-0 ${
                  active ? 'bg-brand-soft text-brand' : 'hover:bg-brand-soft'
                }`}
              >
                <Avatar src={item.avatarUrl} name={name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{name}</span>
                  <span
                    className={`block truncate text-sm ${
                      item.unread > 0 ? 'font-medium text-stone-800' : 'text-stone-500'
                    }`}
                  >
                    {previewFor(item)}
                  </span>
                </span>
                <span className="flex flex-shrink-0 flex-col items-end gap-1">
                  {item.lastAt && (
                    <span suppressHydrationWarning className="text-xs text-stone-400">
                      {timeAgo(item.lastAt)}
                    </span>
                  )}
                  {item.unread > 0 ? (
                    <span className="min-w-[1.25rem] rounded-full bg-brand px-1.5 py-0.5 text-center text-[11px] font-medium text-white">
                      {item.unread}
                    </span>
                  ) : (
                    status && <span className="text-[10px] text-stone-400">{status}</span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
