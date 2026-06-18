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

export async function setEmailPreferences(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const frequency = String(formData.get('email_notification_frequency') ?? 'immediate');
  const validFrequency = ['immediate', 'daily', 'weekly', 'off'];
  const normalizedFrequency = validFrequency.includes(frequency) ? frequency : 'immediate';

  await supabase
    .from('profiles')
    .update({
      email_notifications: normalizedFrequency !== 'off',
      email_notification_frequency: normalizedFrequency,
      email_article_updates: formData.get('email_article_updates') === 'on',
    })
    .eq('id', user.id);

  revalidatePath('/settings');
}

// Set (or change) the signed-in user's password. Works even for accounts
// created via Google sign-in, which start with no password — afterwards they
// can also log in with their username/email + this password. Does NOT sign
// the user out, so they stay logged in.
export async function setPassword(
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) return { error: 'Use at least 8 characters.' };
  if (password !== confirm) return { error: 'Passwords do not match.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'Could not set your password. Please try again.' };

  return { error: null };
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
