'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GENRES } from '@/lib/genres';
import { coverUrl } from '@/lib/openlibrary';
import { completeOnboarding } from '@/app/actions/profile';
import BookCoverImage from '@/components/BookCoverImage';

type StarterBook = {
  key: string;
  title: string;
  author?: string;
  coverId?: number;
};

export default function WelcomeForm({
  initialUsername,
  defaultName,
  initialGenres,
}: {
  initialUsername: string;
  defaultName: string;
  initialGenres: string[];
}) {
  const [username, setUsername] = useState(initialUsername);
  const [name, setName] = useState(defaultName);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialGenres));
  const [starterBooks, setStarterBooks] = useState<StarterBook[]>([]);
  const [starterLoading, setStarterLoading] = useState(false);
  const [pickedBooks, setPickedBooks] = useState<Map<string, StarterBook>>(new Map());
  const [followFounders, setFollowFounders] = useState(true);
  const [saveStarterLists, setSaveStarterLists] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const selectedKey = useMemo(() => Array.from(selected).sort().join(','), [selected]);

  useEffect(() => {
    if (!selectedKey) {
      setStarterBooks([]);
      return;
    }

    const controller = new AbortController();
    setStarterLoading(true);
    fetch(`/api/onboarding/starter-books?genres=${encodeURIComponent(selectedKey)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setStarterBooks(Array.isArray(data.items) ? data.items : []))
      .catch(() => {
        if (!controller.signal.aborted) setStarterBooks([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setStarterLoading(false);
      });

    return () => controller.abort();
  }, [selectedKey]);

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  function toggleBook(book: StarterBook) {
    setPickedBooks((prev) => {
      const next = new Map(prev);
      next.has(book.key) ? next.delete(book.key) : next.set(book.key, book);
      return next;
    });
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const res = await completeOnboarding(name, username, Array.from(selected), {
        starterBooks: Array.from(pickedBooks.values()),
        followFounders,
        saveStarterLists,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push('/');
      router.refresh();
    });
  }

  return (
    <div className="mt-8 space-y-8">
      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="mb-1 text-lg font-semibold">Bring your books</h2>
        <p className="mb-3 text-sm text-stone-500">
          Already tracked your reading somewhere else? Importing first gives your profile a head start.
        </p>
        <Link href="/settings/import" className="inline-flex rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:border-brand hover:text-brand">
          Import from Goodreads
        </Link>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Pick your username</h2>
        <p className="mb-3 text-sm text-stone-500">3–20 characters · letters, numbers, periods, underscores.</p>
        <div className="relative max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded border border-slate-300 py-2 pl-7 pr-3"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">What should we call you?</h2>
        <p className="mb-3 text-sm text-stone-500">Your display name / nickname (you can change it later).</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="e.g. Nesha"
          className="w-full max-w-xs rounded border border-slate-300 px-3 py-2"
        />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Pick a few favourite genres</h2>
        <p className="mb-3 text-sm text-stone-500">We’ll use these to recommend books. Optional — pick any, or none.</p>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => {
            const on = selected.has(g.slug);
            return (
              <button
                key={g.slug}
                type="button"
                onClick={() => toggle(g.slug)}
                className={on
                  ? 'rounded-full border border-brand bg-brand px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-600 transition hover:border-brand hover:text-brand'}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Add a few starter books</h2>
        <p className="mb-3 text-sm text-stone-500">
          Pick anything that looks interesting. These go to Want to read.
        </p>
        {selected.size === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-400">
            Choose genres above to see starter books.
          </p>
        ) : starterLoading ? (
          <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">Finding starter books...</p>
        ) : starterBooks.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
            Starter books are unavailable right now. You can still finish setup.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {starterBooks.map((book) => {
              const on = pickedBooks.has(book.key);
              const src = coverUrl(book.coverId, 'M');
              return (
                <button
                  key={book.key}
                  type="button"
                  onClick={() => toggleBook(book)}
                  className={`group rounded-lg border p-2 text-left transition ${
                    on ? 'border-brand bg-brand-soft' : 'border-stone-200 bg-white hover:border-brand'
                  }`}
                >
                  <div className="book-cover-fallback aspect-[2/3] w-full overflow-hidden rounded">
                    <span aria-hidden="true" className="absolute inset-2 z-0 flex items-center justify-center overflow-hidden text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-stone-600">
                      {book.title.slice(0, 36)}
                    </span>
                    <BookCoverImage
                      src={src}
                      alt={book.title}
                      width={160}
                      height={240}
                      className="relative z-10 h-full w-full object-cover"
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-stone-800">{book.title}</p>
                  {book.author && <p className="line-clamp-1 text-xs text-stone-500">{book.author}</p>}
                  <p className={`mt-1 text-xs font-medium ${on ? 'text-brand' : 'text-stone-400'}`}>
                    {on ? 'Added' : 'Tap to add'}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={followFounders}
            onChange={(e) => setFollowFounders(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block font-medium text-stone-700">Follow the founders</span>
            <span className="text-stone-500">Start with Nesha and Niki in your network.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={saveStarterLists}
            onChange={(e) => setSaveStarterLists(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block font-medium text-stone-700">Save starter lists</span>
            <span className="text-stone-500">Keep curated lists for the genres you picked.</span>
          </span>
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={finish}
          disabled={pending}
          className="rounded-full bg-brand px-6 py-2 font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? 'Setting up…' : 'Finish & start reading'}
        </button>
      </div>
    </div>
  );
}
