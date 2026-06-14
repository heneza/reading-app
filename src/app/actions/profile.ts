'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { normalizeUsername, validateUsername } from '@/lib/username';

// Clean a text field: trim, and turn empty strings into null.
function clean(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

export async function updateProfile(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('profiles')
    .update({
      display_name: clean(formData.get('display_name')),
      bio: clean(formData.get('bio')),
      website: clean(formData.get('website')),
      twitter: clean(formData.get('twitter')),
      instagram: clean(formData.get('instagram')),
    })
    .eq('id', user.id);

  const { data: p } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  redirect(`/u/${p?.username ?? ''}`);
}

// Change the signed-in user's username, enforcing format, uniqueness, and a
// 7-day cooldown between changes. Returns { error } so the form can react.
export async function changeUsername(
  newName: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const uname = normalizeUsername(newName);
  const fmtError = validateUsername(uname);
  if (fmtError) return { error: fmtError };

  const { data: me } = await supabase
    .from('profiles')
    .select('username, username_changed_at')
    .eq('id', user.id)
    .maybeSingle();

  if (me?.username === uname) return { error: null }; // nothing to change

  if (me?.username_changed_at) {
    const days = (Date.now() - new Date(me.username_changed_at).getTime()) / 86400000;
    if (days < 7) {
      const left = Math.ceil(7 - days);
      return { error: `You can change your username again in ${left} day${left === 1 ? '' : 's'}.` };
    }
  }

  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', uname)
    .neq('id', user.id)
    .maybeSingle();
  if (taken) return { error: `@${uname} is taken — please choose another.` };

  const { error } = await supabase
    .from('profiles')
    .update({ username: uname, username_changed_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/settings');
  revalidatePath(`/u/${uname}`);
  return { error: null };
}

// Set (or clear, with '') the signed-in user's avatar URL.
export async function setAvatar(url: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: url || null })
    .eq('id', user.id);
  if (error) return { error: error.message };

  const { data: p } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  if (p?.username) revalidatePath(`/u/${p.username}`);
  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { error: null };
}

// Who can see your likes / comments history on your profile.
export async function setVisibility(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const valid = ['public', 'friends', 'private'];
  const likes = String(formData.get('likes_visibility') ?? 'public');
  const comments = String(formData.get('comments_visibility') ?? 'public');

  await supabase
    .from('profiles')
    .update({
      likes_visibility: valid.includes(likes) ? likes : 'public',
      comments_visibility: valid.includes(comments) ? comments : 'public',
    })
    .eq('id', user.id);

  revalidatePath('/settings');
}
