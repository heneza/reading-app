'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// Adds (or updates) a book on the current user's shelf with a status.
export async function addToShelf(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const olKey = String(formData.get('olKey'));
  const title = String(formData.get('title'));
  const author = String(formData.get('author') ?? '');
  const coverRaw = formData.get('coverId');
  const coverId = coverRaw ? Number(coverRaw) : null;
  const status = String(formData.get('status') ?? 'read');

  // 1. Make sure the book exists in our shared catalogue cache.
  const { data: book, error: bookErr } = await supabase
    .from('books')
    .upsert(
      { ol_key: olKey, title, author, cover_id: coverId },
      { onConflict: 'ol_key' }
    )
    .select('id')
    .single();

  if (bookErr || !book) {
    redirect('/search?error=' + encodeURIComponent('Could not save book.'));
  }

  // 2. Upsert the user's reading entry.
  await supabase.from('reading_entries').upsert(
    { user_id: user.id, book_id: book.id, status },
    { onConflict: 'user_id,book_id' }
  );

  revalidatePath('/');
  redirect('/');
}

// Removes a book from the current user's shelf (deletes their reading entry).
export async function removeFromShelf(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));

  // .delete() removes rows that match. The .eq() filters make sure we only
  // ever delete THIS user's entry for THIS book — and RLS enforces it too.
  await supabase
    .from('reading_entries')
    .delete()
    .eq('user_id', user.id)
    .eq('book_id', bookId);

  revalidatePath('/');
  redirect('/');
}
