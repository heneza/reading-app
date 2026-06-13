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

export async function saveReview(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[saveReview] user id:', user?.id ?? 'NULL (not authenticated on server)');
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const reviewId = formData.get('reviewId') ? String(formData.get('reviewId')) : null;
  const body = String(formData.get('body') ?? '').trim();
  const spoiler = formData.get('spoiler') === 'on';
  console.log('[saveReview] bookId:', bookId, 'reviewId:', reviewId, 'bodyLength:', body.length);

  if (body) {
    if (reviewId) {
      const { error } = await supabase.from('reviews').update({ body, spoiler })
        .eq('id', reviewId).eq('user_id', user.id);
      console.log('[saveReview] UPDATE error:', error ? JSON.stringify(error) : 'none');
    } else {
      const { error } = await supabase.from('reviews')
        .insert({ user_id: user.id, book_id: bookId, body, spoiler });
      console.log('[saveReview] INSERT error:', error ? JSON.stringify(error) : 'none');
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

// Like or dislike a review. Clicking the same reaction again removes it (toggle).
export async function reactToReview(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const reviewId = String(formData.get('reviewId'));
  const type = String(formData.get('type')); // 'like' | 'dislike'

  const { data: existing } = await supabase
    .from('review_reactions')
    .select('type')
    .eq('review_id', reviewId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing && existing.type === type) {
    // Same button pressed again -> remove the reaction.
    await supabase.from('review_reactions')
      .delete().eq('review_id', reviewId).eq('user_id', user.id);
  } else {
    // New reaction, or switching like<->dislike.
    await supabase.from('review_reactions')
      .upsert({ review_id: reviewId, user_id: user.id, type }, { onConflict: 'review_id,user_id' });
  }

  revalidatePath(`/book/${bookId}`);
}

// --- Replies (comments) on reviews ---
export async function addReviewComment(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const reviewId = String(formData.get('reviewId'));
  const body = String(formData.get('body') ?? '').trim();

  if (body) {
    await supabase
      .from('review_comments')
      .insert({ review_id: reviewId, user_id: user.id, body });
  }
  redirect(`/book/${bookId}`);
}

export async function deleteReviewComment(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const commentId = String(formData.get('commentId'));

  await supabase
    .from('review_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id);

  redirect(`/book/${bookId}`);
}
