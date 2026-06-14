'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logReadingHours } from '@/app/actions/goals';

const MAX_SECONDS = 3 * 60 * 60; // pomodoro cap: log up to 3 hours

function fmt(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function ReadingTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Tick once per second while running; auto-stop at the 3h cap.
  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) {
          setRunning(false);
          return MAX_SECONDS;
        }
        return s + 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  function logIt() {
    const hours = seconds / 3600;
    if (hours <= 0) return;
    setRunning(false);
    startTransition(async () => {
      await logReadingHours(Number(hours.toFixed(2)), 'timer');
      setSeconds(0);
      router.refresh();
    });
  }

  const atCap = seconds >= MAX_SECONDS;

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-400">Reading timer</span>
        <span className="font-mono text-lg tabular-nums text-stone-700">{fmt(seconds)}</span>
      </div>
      {atCap && <p className="mt-1 text-[11px] text-brand">Reached the 3-hour cap — log it to save.</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {!running ? (
          <button type="button" onClick={() => setRunning(true)} disabled={atCap || pending}
            className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40">
            {seconds > 0 ? 'Resume' : 'Start'}
          </button>
        ) : (
          <button type="button" onClick={() => setRunning(false)}
            className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">
            Pause
          </button>
        )}
        <button type="button" onClick={logIt} disabled={seconds <= 0 || pending}
          className="rounded-full border border-brand px-3 py-1 text-xs font-medium text-brand hover:bg-brand-soft disabled:opacity-40">
          {pending ? 'Logging…' : 'Log session'}
        </button>
        <button type="button" onClick={() => { setRunning(false); setSeconds(0); }} disabled={seconds <= 0 || pending}
          className="rounded-full px-3 py-1 text-xs text-stone-400 hover:text-red-600 disabled:opacity-40">
          Reset
        </button>
      </div>
    </div>
  );
}
