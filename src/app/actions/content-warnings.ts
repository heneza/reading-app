'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// Flag a content warning on a book (community-contributed).
export async function addContentWarning(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  // Normalise: trim, collapse spaces, cap length, Title-case-ish left as typed.
  const warning = String(formData.get('warning') ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!warning) {
    revalidatePath(`/book/${bookId}`);
    return;
  }

  // upsert-by-unique: ignore if this user already flagged this exact warning.
  await supabase
    .from('content_warnings')
    .upsert(
      { book_id: bookId, user_id: user.id, warning },
      { onConflict: 'book_id,user_id,warning', ignoreDuplicates: true }
    );

  revalidatePath(`/book/${bookId}`);
}

// Remove one of your own flags.
export async function removeContentWarning(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const bookId = String(formData.get('bookId'));
  const warning = String(formData.get('warning'));

  await supabase
    .from('content_warnings')
    .delete()
    .eq('book_id', bookId)
    .eq('user_id', user.id)
    .eq('warning', warning);

  revalidatePath(`/book/${bookId}`);
}
