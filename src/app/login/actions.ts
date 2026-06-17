'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { normalizeUsername, validateUsername } from '@/lib/username';

function getCaptchaToken(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return undefined;
  return String(formData.get('cf-turnstile-response') ?? '').trim() || null;
}

function safeInternalPath(raw: FormDataEntryValue | null, fallback: string) {
  const path = String(raw ?? '').trim();
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback;
  return path;
}

function redirectWithParam(path: string, key: 'error' | 'message', value: string) {
  const url = new URL(path, 'https://reading-app.local');
  url.searchParams.set(key, value);
  redirect(`${url.pathname}${url.search}`);
}

function signupError(message: string, fields: { username?: string; dob?: string; gender?: string } = {}) {
  const params = new URLSearchParams({ mode: 'signup', error: message });
  if (fields.username) params.set('username', fields.username);
  if (/^\d{4}-\d{2}-\d{2}$/.test(fields.dob ?? '')) params.set('dob', fields.dob!);
  if (fields.gender) params.set('gender', fields.gender);
  redirect(`/login?${params.toString()}`);
}

function friendlySignupError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('captcha')) return 'Verification failed. Refresh the page and try the Cloudflare check again.';
  if ((lower.includes('signup') || lower.includes('sign up')) && lower.includes('disabled')) {
    return 'Email signup is disabled in Supabase. Enable the Email provider and try again.';
  }
  if (lower.includes('rate limit')) return 'Too many signup attempts. Wait a minute, then try again.';
  if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
    return 'That email may already have an account. Try logging in or use another email.';
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return 'Supabase rejected that email address. Try another email you can access.';
  }
  if (lower.includes('password')) return 'Choose a stronger password and try again.';
  if (lower.includes('email')) return 'Supabase rejected that email. Try another email or check the Auth logs.';
  return 'Could not create your account. Please try again.';
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
  const next = safeInternalPath(formData.get('next'), '/');
  const captchaToken = getCaptchaToken(formData);

  if (captchaToken === null) {
    redirect('/login?next=' + encodeURIComponent(next) + '&error=' + encodeURIComponent('Complete the verification, then try again.'));
  }

  // If they typed a username (no "@"), resolve it to the account email.
  // This must happen server-side with the service-role key: email_for_username
  // reads auth.users, so it is no longer callable by anon/authenticated clients
  // (otherwise anyone could map every username to its email). On any failure we
  // leave email empty and fall through to the generic "invalid login" error.
  let email = identifier;
  if (identifier && !identifier.includes('@')) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.rpc('email_for_username', { uname: identifier });
      email = typeof data === 'string' ? data : '';
    } catch {
      email = '';
    }
  }

  const { error } = email
    ? await supabase.auth.signInWithPassword({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
      })
    : { error: { message: 'no-account' } as { message: string } };

  if (!email || error) {
    if (error?.message?.toLowerCase().includes('captcha')) {
      redirect('/login?next=' + encodeURIComponent(next) + '&error=' + encodeURIComponent('Verification failed. Refresh the page and try the Cloudflare check again.'));
    }
    // One generic message for every failure (no account enumeration).
    redirect('/login?next=' + encodeURIComponent(next) + '&error=' + encodeURIComponent('Invalid login — check your email/username and password.'));
  }
  revalidatePath('/', 'layout');
  // Send users who never finished onboarding to /welcome.
  const { data: { user: signedIn } } = await supabase.auth.getUser();
  if (signedIn) {
    const { data: prof } = await supabase.from('profiles').select('onboarded').eq('id', signedIn.id).maybeSingle();
    if (prof && prof.onboarded === false) redirect('/welcome');
  }
  redirect(next);
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = createClient();
  const email = String(formData.get('email') ?? '').trim();
  const next = safeInternalPath(formData.get('next'), '/reset-password');
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? headers().get('origin') ?? 'https://reading-app-sandy.vercel.app';
  const captchaToken = getCaptchaToken(formData);

  if (captchaToken === null) {
    redirectWithParam(next, 'error', 'Complete the verification, then try again.');
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirectWithParam(next, 'error', 'Enter the email address connected to your account.');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/callback?next=/reset-password/update`,
    captchaToken: captchaToken || undefined,
  });

  if (error) {
    console.error('Password reset request failed:', error.message);
  }

  redirectWithParam(next, 'message', 'If that email belongs to an account, a reset link is on its way.');
}

export async function updatePassword(formData: FormData) {
  const supabase = createClient();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) {
    redirect('/reset-password/update?error=' + encodeURIComponent('Use at least 8 characters.'));
  }
  if (password !== confirm) {
    redirect('/reset-password/update?error=' + encodeURIComponent('Passwords do not match.'));
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error('Password update failed:', error.message);
    redirect('/reset-password/update?error=' + encodeURIComponent('Could not update your password. Open the latest reset link and try again.'));
  }

  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login?message=' + encodeURIComponent('Password updated. Log in with your new password.'));
}

export async function signup(formData: FormData) {
  const supabase = createClient();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password'));
  const dob = String(formData.get('dob') ?? '').trim();
  const gender = String(formData.get('gender') ?? '').trim();
  const username = normalizeUsername(String(formData.get('username') ?? ''));
  const captchaToken = getCaptchaToken(formData);

  const err = (m: string) => signupError(m, { username, dob, gender });

  if (captchaToken === null) err('Complete the verification, then try again.');

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

  // Username taken? (case-insensitive)
  const { data: taken } = await supabase.from('profiles').select('id').ilike('username', username).maybeSingle();
  if (taken) err(`@${username} is taken — please choose another.`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: captchaToken || undefined,
      data: { username, date_of_birth: dob, gender: g },
    },
  });
  if (error) {
    console.error('Signup failed:', error.message);
    err(friendlySignupError(error.message));
  }

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
