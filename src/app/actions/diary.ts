'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// Log one reading session for a book (Letterboxd-style diary entry).
// Each call inserts a NEW row, so logging the same book again counts as a reread.
export async function logRead(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));

  // read_on: the date input gives "YYYY-MM-DD". Empty -> today.
  const readOnRaw = String(formData.get('readOn') ?? '').trim();
  const readOn = readOnRaw || new Date().toISOString().slice(0, 10);

  const ratingRaw = formData.get('rating');
  const rating = ratingRaw && String(ratingRaw).trim() ? Number(ratingRaw) : null;

  const note = String(formData.get('note') ?? '').trim() || null;

  // Have we logged this book before? If so this one is a reread.
  const { count } = await supabase
    .from('diary_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('book_id', bookId);
  const isReread = (count ?? 0) > 0;

  await supabase.from('diary_entries').insert({
    user_id: user.id,
    book_id: bookId,
    read_on: readOn,
    rating,
    note,
    is_reread: isReread,
  });

  // Keep the shelf consistent: logging a read means you've read it.
  // We also push the rating onto the shelf entry when one was given, so the
  // book's star rating reflects your latest read.
  const shelfPatch: Record<string, unknown> = { user_id: user.id, book_id: bookId, status: 'read' };
  if (rating !== null) shelfPatch.rating = rating;
  await supabase
    .from('reading_entries')
    .upsert(shelfPatch, { onConflict: 'user_id,book_id' });

  revalidatePath(`/book/${bookId}`);
  if (user) {
    const { data: me } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
    if (me?.username) revalidatePath(`/u/${me.username}`);
  }
}

// Delete one of your own diary entries.
export async function deleteDiaryEntry(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const entryId = String(formData.get('entryId'));
  const bookId = String(formData.get('bookId') ?? '');

  // The .eq('user_id') filter + RLS both ensure you can only delete your own.
  await supabase.from('diary_entries').delete().eq('id', entryId).eq('user_id', user.id);

  if (bookId) revalidatePath(`/book/${bookId}`);
  const { data: me } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
  if (me?.username) revalidatePath(`/u/${me.username}`);
}
