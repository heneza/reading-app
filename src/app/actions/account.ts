'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// Toggle the AI assistant on/off for the signed-in user.
export async function setAiEnabled(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const on = String(formData.get('ai_enabled')) === 'on';
  await supabase.from('profiles').update({ ai_enabled: on }).eq('id', user.id);
  revalidatePath('/settings');
  revalidatePath('/', 'layout');
}

// Permanently delete the user's account and all their data (GDPR erasure).
export async function deleteAccount() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await supabase.rpc('delete_user');
  await supabase.auth.signOut();
  redirect('/login?message=' + encodeURIComponent('Your account and data have been deleted.'));
}
