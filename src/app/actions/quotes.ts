'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

function text(formData: FormData, key: string, max: number) {
  const value = String(formData.get(key) ?? '').trim();
  return value ? value.slice(0, max) : null;
}

function cleanTags(raw: string | null) {
  return Array.from(
    new Set(
      (raw ?? '')
        .split(/[,\s]+/)
        .map((tag) => tag.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean)
    )
  ).slice(0, 20);
}

export async function createQuote(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const body = text(formData, 'body', 1000);
  if (!body) redirect('/quotes?error=' + encodeURIComponent('Write or paste a quote first.'));

  const visibility = String(formData.get('visibility')) === 'public' ? 'public' : 'private';
  const { error } = await supabase.from('quotes').insert({
    user_id: user.id,
    body,
    source_title: text(formData, 'source_title', 160),
    source_author: text(formData, 'source_author', 120),
    note: text(formData, 'note', 500),
    tags: cleanTags(String(formData.get('tags') ?? '')),
    visibility,
  });

  if (error) redirect('/quotes?error=' + encodeURIComponent('Quotes are not ready yet. Run the latest Supabase migration.'));
  revalidatePath('/quotes');
  redirect('/quotes');
}

export async function deleteQuote(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const id = String(formData.get('id') ?? '');
  if (id) await supabase.from('quotes').delete().eq('id', id).eq('user_id', user.id);
  revalidatePath('/quotes');
}
