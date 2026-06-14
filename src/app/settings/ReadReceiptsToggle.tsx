'use client';

import { useState, useTransition } from 'react';
import { setReadReceipts } from '@/app/actions/messages';

export default function ReadReceiptsToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const res = await setReadReceipts(next);
      if (res.error) setOn(!next); // revert on failure
    });
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span>
        Read receipts
        <span className="block text-xs text-stone-400">
          Let others see when you have read their messages.
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        disabled={pending}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${on ? 'bg-brand' : 'bg-stone-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}
