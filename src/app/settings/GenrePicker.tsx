'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GENRES } from '@/lib/genres';
import { setMyGenres } from '@/app/actions/genres';

export default function GenrePicker({
  initial,
  username,
}: {
  initial: string[];
  username: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setMyGenres(Array.from(selected));
      if (res.error) {
        setError(res.error);
        return;
      }
      if (username) router.push(`/u/${username}`);
      router.refresh();
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {GENRES.map((g) => {
          const on = selected.has(g.slug);
          return (
            <button
              key={g.slug}
              type="button"
              onClick={() => toggle(g.slug)}
              className={
                on
                  ? 'rounded-full border border-brand bg-brand px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-600 transition hover:border-brand hover:text-brand'
              }
            >
              {g.name}
            </button>
          );
        })}
      </div>

      <button
        onClick={save}
        disabled={pending}
        className="mt-4 rounded bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save genres'}
      </button>
    </div>
  );
}
