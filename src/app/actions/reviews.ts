'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// Save (or update) the current user's star rating for a book.
export async function saveRating(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const ratingRaw = formData.get('rating');
  const rating = ratingRaw ? Number(ratingRaw) : null;

  // upsert = "insert, or update if a row for this (user, book) already exists".
  // We only send rating, so an existing status is left untouched.
  await supabase
    .from('reading_entries')
    .upsert(
      { user_id: user.id, book_id: bookId, rating },
      { onConflict: 'user_id,book_id' }
    );

  revalidatePath(`/book/${bookId}`);
}

// Save (or update) the current user's written review for a book.
export async function saveReview(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const body = String(formData.get('body') ?? '').trim();
  const spoiler = formData.get('spoiler') === 'on';

  if (!body) {
    // Nothing typed — just refresh the page.
    revalidatePath(`/book/${bookId}`);
    return;
  }

  await supabase
    .from('reviews')
    .upsert(
      { user_id: user.id, book_id: bookId, body, spoiler },
      { onConflict: 'user_id,book_id' }
    );

  revalidatePath(`/book/${bookId}`);
}
