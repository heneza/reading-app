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

// Only accept http(s) URLs (blocks javascript: / data: URI injection).
function cleanUrl(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s.slice(0, 300) : null;
}

// Social handles: strip to a safe charset so they can't break out of the URL.
function cleanHandle(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim().replace(/^@/, '').replace(/[^A-Za-z0-9_.]/g, '');
  return s ? s.slice(0, 40) : null;
}

function clampText(v: FormDataEntryValue | null, max: number): string | null {
  const s = clean(v);
  return s ? s.slice(0, max) : null;
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
      display_name: clampText(formData.get('display_name'), 80),
      bio: clampText(formData.get('bio'), 500),
      website: cleanUrl(formData.get('website')),
      twitter: cleanHandle(formData.get('twitter')),
      instagram: cleanHandle(formData.get('instagram')),
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


// Finish onboarding: set the display name + starter genres, then go home.
export async function completeOnboarding(
  displayName: string,
  username: string,
  slugs: string[]
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const { data: me } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();

  // Username — validate + ensure unique only if it changed.
  const uname = normalizeUsername(username ?? '');
  if (uname && uname !== me?.username) {
    const fmtError = validateUsername(uname);
    if (fmtError) return { error: fmtError };
    const { data: taken } = await supabase
      .from('profiles').select('id').ilike('username', uname).neq('id', user.id).maybeSingle();
    if (taken) return { error: `@${uname} is taken — please choose another.` };
    const { error: uErr } = await supabase.from('profiles').update({ username: uname }).eq('id', user.id);
    if (uErr) return { error: 'Could not set that username.' };
  }

  const name = String(displayName ?? '').trim().slice(0, 80) || null;
  await supabase.from('profiles').update({ display_name: name, onboarded: true }).eq('id', user.id);

  await supabase.from('profile_genres').delete().eq('user_id', user.id);
  const clean = (slugs ?? []).filter((x) => typeof x === 'string').slice(0, 29);
  if (clean.length) {
    await supabase.from('profile_genres').insert(clean.map((genre) => ({ user_id: user.id, genre })));
  }

  const finalU = uname || me?.username;
  if (finalU) revalidatePath(`/u/${finalU}`);
  return { error: null };
}
