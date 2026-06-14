'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GENRES } from '@/lib/genres';
import { completeOnboarding } from '@/app/actions/profile';

export default function WelcomeForm({
  username,
  defaultName,
  initialGenres,
}: {
  username: string;
  defaultName: string;
  initialGenres: string[];
}) {
  const [name, setName] = useState(defaultName);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialGenres));
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
    startTransition(async () => {
      await completeOnboarding(name, Array.from(selected));
      router.push(username ? `/u/${username}` : '/');
      router.refresh();
    });
  }

  return (
    <div className="mt-8 space-y-8">
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
          {pending ? 'Setting up…' : 'Finish & go to my profile'}
        </button>
        <button onClick={finish} disabled={pending} className="text-sm text-stone-400 hover:text-brand">
          Skip for now
        </button>
      </div>
    </div>
  );
}
