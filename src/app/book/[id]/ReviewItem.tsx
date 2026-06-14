'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/time';
import { submitReview, removeReview } from '@/app/actions/reviews';

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

// One review card. Owners get pencil (inline edit) + trash (delete) icons.
// Reactions and replies are passed in as `children` (still server-rendered).
export default function ReviewItem({
  bookId,
  reviewId,
  username,
  avatarUrl,
  createdAt,
  body,
  spoiler,
  mine,
  children,
}: {
  bookId: string;
  reviewId: string;
  username: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
  body: string;
  spoiler: boolean;
  mine: boolean;
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [draftSpoiler, setDraftSpoiler] = useState(spoiler);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function saveEdit() {
    const text = draft.trim();
    if (!text) {
      setError('Review cannot be empty.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitReview({ bookId, reviewId, body: text, spoiler: draftSpoiler });
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function cancelEdit() {
    setDraft(body);
    setDraftSpoiler(spoiler);
    setError(null);
    setEditing(false);
  }

  function handleDelete() {
    if (!window.confirm('Delete this review?')) return;
    setError(null);
    startTransition(async () => {
      const res = await removeReview({ bookId, reviewId });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className={`rounded border p-4 ${mine ? 'border-brand/40 bg-brand/5' : 'border-slate-200 bg-white'}`}>
      {/* header: author + (your) tag + spoiler tag + edit/delete icons */}
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Avatar src={avatarUrl} name={username ?? 'reader'} size={28} />
          <Link href={`/u/${username}`} className="hover:underline">@{username ?? 'reader'}</Link>
          {createdAt && (
            <span className="text-xs font-normal text-stone-400">· {timeAgo(createdAt)}</span>
          )}
          {mine && <span className="ml-2 rounded bg-brand px-2 py-0.5 text-xs text-white">you</span>}
          {(editing ? draftSpoiler : spoiler) && (
            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">spoiler</span>
          )}
        </div>

        {mine && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Edit review"
            className="flex-shrink-0 text-slate-400 hover:text-brand"
          >
            <PencilIcon />
          </button>
        )}
      </div>

      {error && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded border border-slate-300 p-3"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={draftSpoiler} onChange={(e) => setDraftSpoiler(e.target.checked)} />
              Contains spoilers
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={handleDelete} disabled={pending} className="flex items-center gap-1 rounded border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                <TrashIcon /> Delete
              </button>
              <button type="button" onClick={cancelEdit} disabled={pending} className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={saveEdit} disabled={pending} className="rounded bg-brand px-4 py-1 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-slate-700">{body}</p>
      )}

      {children}
    </li>
  );
}
