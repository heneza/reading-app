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

  const clean = sanitizePostHtml(input.html || '');
  const text = htmlToText(clean);
  if (!text) return { error: 'Write something first.' };

  const len = text.length;
  const tags = Array.from(
    new Set(
      (input.tags || [])
        .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean)
    )
  ).slice(0, 20);

  let isArticle = !!input.isArticle && len > MAX_SHORT;
  if (len > MAX_SHORT && !isArticle) {
    return {
      error: `This post is ${len} characters. Posts over ${MAX_SHORT} must be marked as an Article (we review those), or shortened.`,
    };
  }

  const status = isArticle ? 'pending' : 'published';

  const { error } = await supabase.from('posts').insert({
    user_id: user.id,
    body_html: clean,
    text_len: len,
    is_article: isArticle,
    status,
    tags,
  });
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
