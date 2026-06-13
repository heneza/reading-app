'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { coverUrl } from '@/lib/openlibrary';
import { setFavoriteBooks } from '@/app/actions/favorites';

type ShelfBook = { id: string; title: string; coverId?: number | null };

export default function FavoritesPicker({
  shelfBooks,
  initial,
  username,
}: {
  shelfBooks: ShelfBook[];
  initial: string[];
  username: string;
}) {
  const [selected, setSelected] = useState<string[]>(initial.slice(0, 4));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev; // cap at 4
      return [...prev, id];
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setFavoriteBooks(selected);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (username) router.push(`/u/${username}`);
      router.refresh();
    });
  }

  if (shelfBooks.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Add some books to your shelf first — then you can choose your favourites.
      </p>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mb-2 text-xs text-stone-500">
        {selected.length}/4 selected · tap a cover to pick (the number shows its order)
      </p>
      <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
        {shelfBooks.map((b) => {
          const pos = selected.indexOf(b.id);
          const on = pos >= 0;
          const src = coverUrl(b.coverId, 'M');
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => toggle(b.id)}
                className="relative block w-full"
                title={b.title}
              >
                <div
                  className={`aspect-[2/3] w-full overflow-hidden rounded bg-slate-100 ${
                    on ? 'ring-2 ring-brand ring-offset-2' : 'hover:opacity-90'
                  }`}
                >
                  {src && (
                    <Image
                      src={src}
                      alt={b.title}
                      width={200}
                      height={300}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                {on && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
                    {pos + 1}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        onClick={save}
        disabled={pending}
        className="mt-4 rounded bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save favourites'}
      </button>
    </div>
  );
}
