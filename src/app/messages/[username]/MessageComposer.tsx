'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendMessage } from '@/app/actions/messages';

export default function MessageComposer({ recipientId }: { recipientId: string }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const res = await sendMessage(recipientId, text);
      if (res.error) {
        setError(res.error);
        return;
      }
      setBody('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="flex-1 rounded-full border border-stone-300 px-4 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? '…' : 'Send'}
        </button>
      </div>
    </form>
  );
}
