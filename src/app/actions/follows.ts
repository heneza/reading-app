'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

async function refresh(formData: FormData, username: string) {
  const redirectTo = formData.get('redirectTo');
  if (redirectTo) redirect(String(redirectTo));
  revalidatePath(`/u/${username}`);
}

export async function followUser(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const followeeId = String(formData.get('followeeId'));
  const username = String(formData.get('username'));

  await supabase
    .from('follows')
    .insert({ follower_id: user.id, followee_id: followeeId });

  await refresh(formData, username);
}

export async function unfollowUser(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const followeeId = String(formData.get('followeeId'));
  const username = String(formData.get('username'));

  await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('followee_id', followeeId);

  await refresh(formData, username);
}
