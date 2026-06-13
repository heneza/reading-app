'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitReview } from '@/app/actions/reviews';

export default function ReviewForm({
  bookId,
  editingReviewId = null,
  defaultBody = '',
  defaultSpoiler = false,
  isEditing = false,
}: {
  bookId: string;
  editingReviewId?: string | null;
  defaultBody?: string;
  defaultSpoiler?: boolean;
  isEditing?: boolean;
}) {
  const [body, setBody] = useState(defaultBody);
  const [spoiler, setSpoiler] = useState(defaultSpoiler);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitReview({ bookId, reviewId: editingReviewId, body, spoiler });
      if (res.error) {
        setError(res.error);
      } else {
        setBody('');
        setSpoiler(false);
        router.push(`/book/${bookId}`);
        router.refresh();
      }
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
          {pending ? 'Posting…' : isEditing ? 'Update review' : 'Post review'}
        </button>
      </div>
    </form>
  );
}
