'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export async function saveRating(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const ratingRaw = formData.get('rating');
  const rating = ratingRaw ? Number(ratingRaw) : null;

  await supabase
    .from('reading_entries')
    .upsert(
      { user_id: user.id, book_id: bookId, rating },
      { onConflict: 'user_id,book_id' }
    );

  revalidatePath(`/book/${bookId}`);
}

// Post a NEW review, or UPDATE an existing one if a reviewId is supplied.
export async function saveReview(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const reviewId = formData.get('reviewId')
    ? String(formData.get('reviewId'))
    : null;
  const body = String(formData.get('body') ?? '').trim();
  const spoiler = formData.get('spoiler') === 'on';

  if (body) {
    if (reviewId) {
      // Editing: update this one review (only if it's mine).
      await supabase
        .from('reviews')
        .update({ body, spoiler })
        .eq('id', reviewId)
        .eq('user_id', user.id);
    } else {
      // New review: insert a fresh row.
      await supabase
        .from('reviews')
        .insert({ user_id: user.id, book_id: bookId, body, spoiler });
    }
  }

  // Redirect re-renders the page: the new review shows in the list and the
  // form comes back empty, ready for another.
  redirect(`/book/${bookId}`);
}

// Delete one specific review by its id (only if it's mine).
export async function deleteReview(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const reviewId = String(formData.get('reviewId'));

  await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', user.id);

  redirect(`/book/${bookId}`);
}
