'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// --- Rating -----------------------------------------------------------
export async function saveRating(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const ratingRaw = formData.get('rating');
  const rating = ratingRaw ? Number(ratingRaw) : null;

  await supabase
    .from('reading_entries')
    .upsert({ user_id: user.id, book_id: bookId, rating }, { onConflict: 'user_id,book_id' });

  revalidatePath(`/book/${bookId}`);
}

// --- Reviews ----------------------------------------------------------
// Create a new review, or update an existing one when reviewId is given.
// Returns { error } (string or null) so the client form can show failures
// on screen instead of silently doing nothing.
export async function submitReview(input: {
  bookId: string;
  reviewId?: string | null;
  body: string;
  spoiler: boolean;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const body = input.body.trim();
  if (!body) return { error: 'Please write something first.' };

  if (input.reviewId) {
    const { error } = await supabase
      .from('reviews')
      .update({ body, spoiler: input.spoiler })
      .eq('id', input.reviewId)
      .eq('user_id', user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from('reviews')
      .insert({ user_id: user.id, book_id: input.bookId, body, spoiler: input.spoiler });
    if (error) return { error: error.message };
  }

  revalidatePath(`/book/${input.bookId}`);
  return { error: null };
}

// Delete one of your own reviews. Returns { error } like submitReview.
export async function removeReview(input: {
  bookId: string;
  reviewId: string;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', input.reviewId)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath(`/book/${input.bookId}`);
  return { error: null };
}

// --- Reactions (like / dislike) --------------------------------------
export async function reactToReview(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const reviewId = String(formData.get('reviewId'));
  const type = String(formData.get('type'));

  const { data: existing } = await supabase
    .from('review_reactions')
    .select('type')
    .eq('review_id', reviewId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing && existing.type === type) {
    await supabase.from('review_reactions').delete().eq('review_id', reviewId).eq('user_id', user.id);
  } else {
    await supabase.from('review_reactions')
      .upsert({ review_id: reviewId, user_id: user.id, type }, { onConflict: 'review_id,user_id' });
  }
  revalidatePath(`/book/${bookId}`);
}

// --- Replies (comments) ----------------------------------------------
export async function addReviewComment(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const reviewId = String(formData.get('reviewId'));
  const body = String(formData.get('body') ?? '').trim();

  if (body) {
    await supabase.from('review_comments').insert({ review_id: reviewId, user_id: user.id, body });
  }
  revalidatePath(`/book/${bookId}`);
}

export async function deleteReviewComment(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const commentId = String(formData.get('commentId'));

  await supabase.from('review_comments').delete().eq('id', commentId).eq('user_id', user.id);
  revalidatePath(`/book/${bookId}`);
}
