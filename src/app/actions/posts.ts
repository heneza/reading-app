'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { sanitizePostHtml, htmlToText } from '@/lib/sanitize';

const MAX_SHORT = 280;

async function revalidateForUser(supabase: any, userId: string) {
  revalidatePath('/');
  revalidatePath('/articles');
  const { data: p } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();
  if (p?.username) revalidatePath(`/u/${p.username}`);
}

function cleanTags(raw: string[]): string[] {
  return Array.from(
    new Set((raw || []).map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))
  ).slice(0, 20);
}

export async function createPost(input: {
  html: string;
  tags: string[];
  isArticle: boolean;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = !!me?.is_admin;

  const clean = sanitizePostHtml(input.html || '');
  const text = htmlToText(clean);
  if (!text) return { error: 'Write something first.' };

  const len = text.length;
  const tags = cleanTags(input.tags);

  const isArticle = !!input.isArticle && len > MAX_SHORT;
  if (len > MAX_SHORT && !isArticle) {
    return {
      error: `This post is ${len} characters. Posts over ${MAX_SHORT} must be marked as an Article (we review those), or shortened.`,
    };
  }

  // Founders publish straight away; everyone else's articles wait for review.
  const status = isArticle && !isAdmin ? 'pending' : 'published';

  const { data: inserted, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      body_html: clean,
      body_text: text,
      text_len: len,
      is_article: isArticle,
      status,
      tags,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  // Notify the founders that an article is waiting for review.
  if (isArticle && !isAdmin && inserted) {
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    const rows = (admins ?? []).map((a: any) => ({
      user_id: a.id,
      type: 'article_pending',
      actor_id: user.id,
      post_id: inserted.id,
    }));
    if (rows.length) await supabase.from('notifications').insert(rows);
  }

  await revalidateForUser(supabase, user.id);
  return { error: null };
}

// Founder approves or rejects a pending article.
export async function reviewPost(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return;

  const postId = String(formData.get('postId'));
  const decision = String(formData.get('decision'));
  const { data: post } = await supabase.from('posts').select('id, user_id').eq('id', postId).maybeSingle();
  if (!post) return;

  if (decision === 'approve') {
    await supabase.from('posts').update({ status: 'published' }).eq('id', postId);
    await supabase.from('notifications').insert({
      user_id: post.user_id, type: 'article_approved', actor_id: user.id, post_id: postId,
    });
  } else {
    await supabase.from('notifications').insert({
      user_id: post.user_id, type: 'article_rejected', actor_id: user.id, post_id: null,
    });
    await supabase.from('posts').delete().eq('id', postId);
  }
  // clear the pending notification for this founder
  await supabase.from('notifications').update({ read: true })
    .eq('user_id', user.id).eq('post_id', postId).eq('type', 'article_pending');

  revalidatePath('/notifications');
  revalidatePath('/articles');
  revalidatePath('/');
}

// Edit a post's body — only within 1 hour of posting. Tags update too.
export async function editPost(input: {
  id: string;
  html: string;
  tags: string[];
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const { data: post } = await supabase.from('posts').select('user_id, created_at').eq('id', input.id).maybeSingle();
  if (!post || post.user_id !== user.id) return { error: 'You can only edit your own posts.' };
  if (Date.now() - new Date(post.created_at).getTime() > 3600_000) {
    return { error: 'Posts can only be edited within 1 hour. You can still change the tags.' };
  }

  const clean = sanitizePostHtml(input.html || '');
  const text = htmlToText(clean);
  if (!text) return { error: 'Write something first.' };

  const { error } = await supabase
    .from('posts')
    .update({ body_html: clean, body_text: text, text_len: text.length, tags: cleanTags(input.tags) })
    .eq('id', input.id)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  await revalidateForUser(supabase, user.id);
  return { error: null };
}

// Edit just the tags — allowed any time.
export async function editTags(input: { id: string; tags: string[] }): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const { error } = await supabase
    .from('posts')
    .update({ tags: cleanTags(input.tags) })
    .eq('id', input.id)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  await revalidateForUser(supabase, user.id);
  return { error: null };
}

export async function deletePost(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get('id'));
  await supabase.from('posts').delete().eq('id', id).eq('user_id', user.id);
  await revalidateForUser(supabase, user.id);
}

// --- Interactions -----------------------------------------------------
export async function reactToPost(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const postId = String(formData.get('postId'));
  const type = String(formData.get('type'));

  const { data: existing } = await supabase
    .from('post_reactions')
    .select('type')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing && existing.type === type) {
    await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id);
  } else {
    await supabase.from('post_reactions')
      .upsert({ post_id: postId, user_id: user.id, type }, { onConflict: 'post_id,user_id' });
  }
  revalidatePath('/');
  revalidatePath('/articles');
}

export async function repost(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const postId = String(formData.get('postId'));

  const { data: existing } = await supabase
    .from('post_reposts')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('post_reposts').delete().eq('post_id', postId).eq('user_id', user.id);
  } else {
    await supabase.from('post_reposts').insert({ post_id: postId, user_id: user.id });
  }
  revalidatePath('/');
  const { data: p } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
  if (p?.username) revalidatePath(`/u/${p.username}`);
}

export async function addPostComment(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const postId = String(formData.get('postId'));
  const body = String(formData.get('body') ?? '').trim();
  if (body) {
    await supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, body });
  }
  revalidatePath('/');
  revalidatePath('/articles');
}

export async function deletePostComment(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const commentId = String(formData.get('commentId'));
  await supabase.from('post_comments').delete().eq('id', commentId).eq('user_id', user.id);
  revalidatePath('/');
  revalidatePath('/articles');
}
