'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { rateBook } from '@/app/actions/reviews';

function Star() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="block shrink-0">
      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.784 1.401 8.168L12 18.896l-7.335 3.866 1.401-8.168L.132 9.21l8.2-1.192z" />
    </svg>
  );
}

export default function StarRating({ bookId, initial }: { bookId: string; initial: number | null }) {
  const [value, setValue] = useState<number>(initial ?? 0);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const shown = hover ?? value;

  function fromEvent(e: React.MouseEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const r = Math.ceil((x / rect.width) * 20) / 4; // 0.25 steps
    return Math.max(0.25, Math.min(5, r));
  }
  function commit(r: number | null) {
    setValue(r ?? 0);
    startTransition(async () => {
      await rateBook(bookId, r);
      router.refresh();
    });
  }

  const label = shown ? (shown % 1 === 0 ? `${shown}` : `${shown}`) : '';

  return (
    <div className="flex items-center gap-2">
      <div
        className="relative inline-block cursor-pointer leading-none"
        onMouseMove={(e) => setHover(fromEvent(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => commit(fromEvent(e))}
      >
        <div className="flex text-stone-300">{[0, 1, 2, 3, 4].map((i) => <Star key={i} />)}</div>
        <div className="pointer-events-none absolute inset-0 flex flex-nowrap overflow-hidden text-brand" style={{ width: `${(shown / 5) * 100}%` }}>
          {[0, 1, 2, 3, 4].map((i) => <Star key={i} />)}
        </div>
      </div>
      <span className="w-8 text-sm text-stone-500">{label || '—'}</span>
      {value > 0 && (
        <button type="button" onClick={() => commit(null)} disabled={pending} className="text-xs text-stone-400 hover:text-red-600">clear</button>
      )}
    </div>
  );
}
