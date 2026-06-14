'use client';

import { useState } from 'react';
import PostComposer from '@/components/PostComposer';

export default function PostEditToggle({
  postId,
  initialHtml,
  initialTags,
  canEditBody,
}: {
  postId: string;
  initialHtml: string;
  initialTags: string[];
  canEditBody: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-stone-400 hover:text-brand">
        {canEditBody ? 'Edit' : 'Edit tags'}
      </button>
    );
  }
  return (
    <div className="mt-2">
      <PostComposer
        editId={postId}
        initialHtml={initialHtml}
        initialTags={initialTags}
        canEditBody={canEditBody}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
