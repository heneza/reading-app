import { createClient } from '@/utils/supabase/server';
import { fetchDescription } from '@/lib/openlibrary';

// Streamed separately so the book page renders instantly; the description
// fills in when Open Library responds, and is cached for next time.
export default async function BookDescription({ bookId, olKey }: { bookId: string; olKey: string }) {
  if (!olKey) return null;
  const desc = await fetchDescription(olKey);
  if (!desc) return null;
  try {
    const supabase = createClient();
    await supabase.from('books').update({ description: desc }).eq('id', bookId);
  } catch {
    /* caching is best-effort */
  }
  return (
    <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">
      {desc.length > 600 ? desc.slice(0, 600).trimEnd() + '…' : desc}
    </p>
  );
}
