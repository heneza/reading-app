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

// Edit one of your own messages.
export async function editMessage(
  id: string,
  body: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };
  const text = body.trim();
  if (!text) return { error: 'Message cannot be empty.' };

  const { error } = await supabase
    .from('messages')
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq('id', id)
    .eq('sender_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/messages');
  return { error: null };
}

// Delete one of your own messages.
export async function deleteMessage(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', id)
    .eq('sender_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/messages');
  return { error: null };
}

// Toggle whether others can see your "Seen" status.
export async function setReadReceipts(on: boolean): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const { error } = await supabase
    .from('profiles')
    .update({ read_receipts: on })
    .eq('id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { error: null };
}
