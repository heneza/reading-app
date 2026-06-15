'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Suggestion = {
  type: 'book' | 'author' | 'user' | 'post';
  title: string;
  subtitle?: string;
  href: string;
};

const TYPE_LABEL: Record<Suggestion['type'], string> = {
  book: 'Book',
  author: 'Author',
  user: 'User',
  post: 'Post',
};

export default function SearchSuggestBox({
  defaultValue = '',
  filter = 'all',
  placeholder = 'Search books, authors, users...',
  className = '',
  inputClassName = '',
  showButton = false,
}: {
  defaultValue?: string;
  filter?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  showButton?: boolean;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pending, startTransition] = useTransition();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const trimmed = query.trim();
  const searchHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('filter', filter);
    if (trimmed) params.set('q', trimmed);
    return `/search?${params.toString()}`;
  }, [filter, trimmed]);

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (trimmed.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: trimmed, filter });
        const res = await fetch(`/api/search/suggest?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items.slice(0, 10) : []);
        setHighlight(-1);
      } catch {
        if (!controller.signal.aborted) setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [filter, trimmed]);

  function go(href = searchHref) {
    if (!trimmed && href === searchHref) return;
    setOpen(false);
    startTransition(() => router.push(href));
  }

  return (
    <form
      action="/search"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className={`relative ${className}`}
    >
      <input type="hidden" name="filter" value={filter === 'all' ? 'books' : filter} />
      <input
        name="q"
        value={query}
        autoComplete="off"
        placeholder={placeholder}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((i) => (i + 1) % items.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((i) => (i <= 0 ? items.length - 1 : i - 1));
          } else if (e.key === 'Enter' && highlight >= 0) {
            e.preventDefault();
            go(items[highlight].href);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={inputClassName}
      />

      {showButton && (
        <button
          className="rounded bg-brand px-4 py-2 font-medium text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
          disabled={pending}
        >
          {pending ? 'Searching...' : 'Search'}
        </button>
      )}

      {open && trimmed.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-card">
          {loading && items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-stone-500">Finding matches...</p>
          ) : items.length > 0 ? (
            <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
              {items.map((item, index) => (
                <li key={`${item.type}:${item.href}:${item.title}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(item.href)}
                    onMouseEnter={() => setHighlight(index)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition ${
                      highlight === index ? 'bg-brand-soft text-brand' : 'text-stone-700 hover:bg-brand-soft hover:text-brand'
                    }`}
                  >
                    <span className="w-14 flex-shrink-0 rounded-full border border-stone-300 px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                      {TYPE_LABEL[item.type]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.title}</span>
                      {item.subtitle && <span className="block truncate text-xs text-stone-500">{item.subtitle}</span>}
                    </span>
                  </button>
                </li>
              ))}
              <li className="border-t border-stone-100">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go()}
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-brand hover:bg-brand-soft"
                >
                  Search all results for &ldquo;{trimmed}&rdquo;
                </button>
              </li>
            </ul>
          ) : (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go()}
              className="block w-full px-3 py-2 text-left text-sm text-stone-500 hover:bg-brand-soft hover:text-brand"
            >
              No quick matches. Search for &ldquo;{trimmed}&rdquo;
            </button>
          )}
        </div>
      )}
    </form>
  );
}
