'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { normalizeUsername, validateUsername } from '@/lib/username';

async function verifyTurnstile(formData: FormData) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;

  const token = String(formData.get('cf-turnstile-response') ?? '');
  if (!token) return false;

  const h = headers();
  const remoteip =
    h.get('CF-Connecting-IP') ??
    h.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    undefined;

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteip) body.append('remoteip', remoteip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

async function sendWelcomeEmail(email: string, username: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Welcome to Reading App',
        html: `
          <p>Hi @${username},</p>
          <p>Welcome to Reading App. Start by choosing a few genres, adding starter books, and following readers whose taste you like.</p>
          <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reading-app-sandy.vercel.app'}/welcome">Finish setting up your profile</a></p>
        `,
        text: `Hi @${username}, welcome to Reading App. Finish setting up your profile: ${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reading-app-sandy.vercel.app'}/welcome`,
        tags: [{ name: 'type', value: 'welcome' }],
      }),
    });
  } catch {
    /* Welcome email is best-effort and must never block signup. */
  }
}

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
  // Send users who never finished onboarding to /welcome.
  const { data: { user: signedIn } } = await supabase.auth.getUser();
  if (signedIn) {
    const { data: prof } = await supabase.from('profiles').select('onboarded').eq('id', signedIn.id).maybeSingle();
    if (prof && prof.onboarded === false) redirect('/welcome');
  }
  redirect('/');
}

export async function signup(formData: FormData) {
  const supabase = createClient();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password'));
  const dob = String(formData.get('dob') ?? '').trim();
  const gender = String(formData.get('gender') ?? '').trim();
  const username = normalizeUsername(String(formData.get('username') ?? ''));

  const err = (m: string) => redirect('/login?mode=signup&error=' + encodeURIComponent(m));

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) err('Enter a valid email address.');

  const fmtError = validateUsername(username);
  if (fmtError) err(fmtError);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) err('Please enter your date of birth.');
  // Age gate: must be at least 13.
  const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!(age >= 13)) err('You must be at least 13 years old to sign up.');
  if (age > 120) err('Please enter a valid date of birth.');

  const allowedGenders = ['female', 'male', 'non-binary', 'other', 'prefer-not-to-say'];
  const g = allowedGenders.includes(gender) ? gender : 'prefer-not-to-say';

  if (!(await verifyTurnstile(formData))) {
    err('Verification failed. Please try again.');
  }

  // Username taken? (case-insensitive)
  const { data: taken } = await supabase.from('profiles').select('id').ilike('username', username).maybeSingle();
  if (taken) err(`@${username} is taken — please choose another.`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, date_of_birth: dob, gender: g } },
  });
  if (error) err('Could not create your account. Try a different email.');

  await sendWelcomeEmail(email, username);

  if (!data.session) {
    redirect('/login?message=' + encodeURIComponent('Check your email to confirm your account, then log in.'));
  }

  revalidatePath('/', 'layout');
  redirect('/welcome');
}

export async function signout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}


// Start "Continue with Google" — redirects to Google, which returns to
// /auth/callback. Requires the Google provider enabled in Supabase.
export async function signInWithGoogle() {
  const supabase = createClient();
  const origin = headers().get('origin') ?? '';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data?.url) {
    redirect('/login?error=' + encodeURIComponent('Could not start Google sign-in.'));
  }
  redirect(data.url);
}
