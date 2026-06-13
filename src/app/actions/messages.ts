'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

// Send a direct message to another user. Returns { error } so the
// composer can show failures inline.
export async function sendMessage(
  recipientId: string,
  body: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const text = body.trim();
  if (!text) return { error: 'Write a message first.' };
  if (recipientId === user.id) return { error: "You can't message yourself." };

  const { error } = await supabase
    .from('messages')
    .insert({ sender_id: user.id, recipient_id: recipientId, body: text });
  if (error) return { error: error.message };

  revalidatePath('/messages');
  return { error: null };
}
