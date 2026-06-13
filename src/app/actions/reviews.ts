'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

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

// Surfaces any failure as ?reviewError=... on the book page so it's visible.
export async function saveReview(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const bookId = String(formData.get('bookId'));

  if (!user) {
    redirect(`/book/${bookId}?reviewError=${encodeURIComponent('No user session on server')}`);
  }

  const reviewId = formData.get('reviewId') ? String(formData.get('reviewId')) : null;
  const body = String(formData.get('body') ?? '').trim();
  const spoiler = formData.get('spoiler') === 'on';

  if (!body) {
    redirect(`/book/${bookId}?reviewError=${encodeURIComponent('Review text was empty')}`);
  }

  if (reviewId) {
    const { error } = await supabase
      .from('reviews')
      .update({ body, spoiler })
      .eq('id', reviewId)
      .eq('user_id', user.id);
    if (error) {
      redirect(`/book/${bookId}?reviewError=${encodeURIComponent(error.message)}`);
    }
  } else {
    const { error } = await supabase
      .from('reviews')
      .insert({ user_id: user.id, book_id: bookId, body, spoiler });
    if (error) {
      redirect(`/book/${bookId}?reviewError=${encodeURIComponent(error.message)}`);
    }
  }

  redirect(`/book/${bookId}`);
}

export async function deleteReview(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const reviewId = String(formData.get('reviewId'));

  await supabase.from('reviews').delete().eq('id', reviewId).eq('user_id', user.id);
  redirect(`/book/${bookId}`);
}

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
  redirect(`/book/${bookId}`);
}

export async function deleteReviewComment(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const commentId = String(formData.get('commentId'));

  await supabase.from('review_comments').delete().eq('id', commentId).eq('user_id', user.id);
  redirect(`/book/${bookId}`);
}

// Client-friendly: returns an error string instead of redirecting, so a
// client component can display it. Used by the ReviewForm component.
export async function submitReview(input: {
  bookId: string;
  reviewId?: string | null;
  body: string;
  spoiler: boolean;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in on the server (session not found).' };

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
