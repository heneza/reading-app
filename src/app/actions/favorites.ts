'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

// Replace the signed-in user's Top-4 favourite books with the given
// ordered list (first id = position 1). Max 4.
export async function setFavoriteBooks(
  bookIds: string[]
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  await supabase.from('favorite_books').delete().eq('user_id', user.id);

  const rows = bookIds.slice(0, 4).map((book_id, i) => ({
    user_id: user.id,
    book_id,
    position: i + 1,
  }));

  if (rows.length) {
    const { error } = await supabase.from('favorite_books').insert(rows);
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
