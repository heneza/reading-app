'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type PreviewItem = {
  id: string;
  text: string;
  href: string;
  read: boolean;
};

export default function NotificationBell({ unread }: { unread: number }) {
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(unread);
  const lastLoadedAt = useRef(0);
  const pathname = usePathname();

  useEffect(() => {
    setUnreadCount(unread);
  }, [unread]);

  useEffect(() => {
    if (pathname === '/notifications') {
      setUnreadCount(0);
      setItems((current) => current.map((item) => ({ ...item, read: true })));
    }
  }, [pathname]);

  function markRead(id?: string) {
    if (!id) {
      setUnreadCount(0);
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      return;
    }

    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    void fetch('/api/notifications/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
      keepalive: true,
    });
  }

  async function loadPreview() {
    if (loading) return;
    const now = Date.now();
    if (loadedOnce && now - lastLoadedAt.current < 3000) return;

    setLoading(true);
    try {
      const res = await fetch('/api/notifications/preview', { cache: 'no-store' });
      if (res.status === 401) {
        setNeedsLogin(true);
        setLoadedOnce(true);
        lastLoadedAt.current = Date.now();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setNeedsLogin(false);
      setLoadedOnce(true);
      lastLoadedAt.current = Date.now();
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
        onClick={() => markRead()}
        className="relative block rounded-full px-2 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{unreadCount}</span>
        )}
      </Link>

      <div className="invisible absolute right-0 top-full z-30 w-72 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Notifications</span>
            <Link href="/notifications" onClick={() => markRead()} className="text-xs font-medium text-brand hover:underline">View all</Link>
          </div>
          {loading && !loadedOnce ? (
            <p className="px-3 py-3 text-sm text-stone-500">Loading...</p>
          ) : needsLogin ? (
            <Link href="/login?next=/notifications" className="block px-3 py-3 text-sm text-stone-500 hover:bg-brand-soft hover:text-brand">
              Log in to view.
            </Link>
          ) : items.length === 0 ? (
            <p className="px-3 py-3 text-sm text-stone-500">Nothing yet.</p>
          ) : (
            <ul className="py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} onClick={() => markRead(item.id)} className="flex gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-brand-soft hover:text-brand">
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
