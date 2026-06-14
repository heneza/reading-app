'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GENRES } from '@/lib/genres';
import { completeOnboarding } from '@/app/actions/profile';

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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const res = await completeOnboarding(name, username, Array.from(selected));
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
