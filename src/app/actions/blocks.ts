'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export async function blockUser(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const blockedId = String(formData.get('blockedId'));
  const username = String(formData.get('username') ?? '');
  if (blockedId && blockedId !== user.id) {
    await supabase.from('blocks').upsert({ blocker_id: user.id, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  }
  if (username) { revalidatePath(`/u/${username}`); revalidatePath(`/messages/${username}`); }
  revalidatePath('/settings');
}

export async function unblockUser(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const blockedId = String(formData.get('blockedId'));
  const username = String(formData.get('username') ?? '');
  await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', blockedId);
  if (username) { revalidatePath(`/u/${username}`); revalidatePath(`/messages/${username}`); }
  revalidatePath('/settings');
}
