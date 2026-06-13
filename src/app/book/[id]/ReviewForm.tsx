'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitReview } from '@/app/actions/reviews';

// Compose form for a NEW review. Editing an existing review happens
// inline on the review card itself (see ReviewItem.tsx).
export default function ReviewForm({ bookId }: { bookId: string }) {
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      setError('Please write something first.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await submitReview({ bookId, body: text, spoiler });
      if (res.error) {
        setError(res.error);
        return;
      }
      // Success: clear the form and pull the fresh server render.
      setBody('');
      setSpoiler(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="What did you think?"
        className="w-full rounded border border-slate-300 p-3"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={spoiler}
            onChange={(e) => setSpoiler(e.target.checked)}
          />
          Contains spoilers
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Posting…' : 'Post review'}
        </button>
      </div>
    </form>
  );
}
