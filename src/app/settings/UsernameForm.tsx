'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { changeUsername } from '@/app/actions/profile';
import { normalizeUsername } from '@/lib/username';

export default function UsernameForm({
  current,
  locked,
  daysLeft,
}: {
  current: string;
  locked: boolean;
  daysLeft: number;
}) {
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await changeUsername(value);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push(`/u/${normalizeUsername(value)}`);
      router.refresh();
    });
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      {locked && (
        <p className="mb-2 text-sm text-stone-500">
          You can change your username again in {daysLeft} day
          {daysLeft === 1 ? '' : 's'}.
        </p>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
            @
          </span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={locked || pending}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded border border-slate-300 py-2 pl-7 pr-3 disabled:bg-stone-100"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={locked || pending}
          className="rounded bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Change'}
        </button>
      </div>
      <p className="mt-1 text-xs text-stone-400">
        3–20 characters · letters, numbers, periods, underscores. You can change
        once every 7 days.
      </p>
    </div>
  );
}
