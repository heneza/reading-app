'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { normalizeUsername, validateUsername } from '@/lib/username';

export async function login(formData: FormData) {
  const supabase = createClient();
  const identifier = String(formData.get('identifier') ?? formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  // If they typed a username (no "@"), resolve it to the account email.
  let email = identifier;
  if (identifier && !identifier.includes('@')) {
    const { data } = await supabase.rpc('email_for_username', { uname: identifier });
    email = typeof data === 'string' ? data : '';
  }

  const { error } = email
    ? await supabase.auth.signInWithPassword({ email, password })
    : { error: { message: 'no-account' } as { message: string } };

  if (!email || error) {
    // One generic message for every failure (no account enumeration).
    redirect('/login?error=' + encodeURIComponent('Invalid login — check your email/username and password.'));
  }
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signup(formData: FormData) {
  const supabase = createClient();
  const email = String(formData.get('identifier') ?? formData.get('email') ?? '').trim();
  const password = String(formData.get('password'));

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect('/login?error=' + encodeURIComponent('Enter a valid email address to sign up.'));
  }
  const username = normalizeUsername(String(formData.get('username') ?? ''));

  // Validate the chosen username.
  const fmtError = validateUsername(username);
  if (fmtError) {
    redirect('/login?error=' + encodeURIComponent(fmtError));
  }

  // Is it already taken? (case-insensitive)
  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle();
  if (taken) {
    redirect(
      '/login?error=' +
        encodeURIComponent(`@${username} is taken — please choose another.`)
    );
  }

  // Create the account, passing the username through to the signup trigger.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
