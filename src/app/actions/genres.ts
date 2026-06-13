'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { fetchSubjects } from '@/lib/openlibrary';
import { classifySubjects } from '@/lib/genres';

// Classify a book from its Open Library subjects and store the genres.
// Safe to call repeatedly (inserts ignore duplicates). Returns the slugs.
// Called eagerly when a book is added, and lazily when a book page is
// viewed by a signed-in user (so older books get backfilled automatically).
export async function classifyBook(
  bookId: string,
  olKey: string
): Promise<string[]> {
  if (!olKey) return [];
  const subjects = await fetchSubjects(olKey);
  const slugs = classifySubjects(subjects);
  if (slugs.length === 0) return [];

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return slugs; // not signed in -> can't write (RLS), just return

  await supabase
    .from('book_genres')
    .upsert(
      slugs.map((genre) => ({ book_id: bookId, genre })),
      { onConflict: 'book_id,genre', ignoreDuplicates: true }
    );

  return slugs;
}

// Replace the signed-in user's favourite genres with the given set.
export async function setMyGenres(
  slugs: string[]
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  // Clear then insert the new selection.
  await supabase.from('profile_genres').delete().eq('user_id', user.id);

  if (slugs.length) {
    const { error } = await supabase
      .from('profile_genres')
      .insert(slugs.map((genre) => ({ user_id: user.id, genre })));
    if (error) return { error: error.message };
  }

  const { data: p } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  if (p?.username) revalidatePath(`/u/${p.username}`);
  revalidatePath('/settings');
  return { error: null };
}
