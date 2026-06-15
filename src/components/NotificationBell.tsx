'use client';

import Link from 'next/link';
import { useState } from 'react';

type PreviewItem = {
  id: string;
  text: string;
  href: string;
  read: boolean;
};

export default function NotificationBell({ unread }: { unread: number }) {
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadPreview() {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications/preview', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="group relative"
      onMouseEnter={loadPreview}
      onFocus={loadPreview}
    >
      <Link
        href="/notifications"
        title="Notifications"
        className="relative block rounded-full px-2 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
        {unread > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{unread}</span>
        )}
      </Link>

      <div className="invisible absolute right-0 top-full z-30 w-72 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Notifications</span>
            <Link href="/notifications" className="text-xs font-medium text-brand hover:underline">View all</Link>
          </div>
          {loading && items.length === 0 ? (
            <p className="px-3 py-3 text-sm text-stone-500">Loading...</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-3 text-sm text-stone-500">Nothing yet.</p>
          ) : (
            <ul className="py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="flex gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-brand-soft hover:text-brand">
                    {!item.read && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />}
                    <span className={item.read ? 'pl-3' : ''}>{item.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
