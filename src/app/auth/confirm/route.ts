import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Verifies email links (password reset, signup confirm, email change) using the
// self-contained token_hash. Unlike the PKCE "?code" flow, this needs no
// per-browser verifier cookie, so the link works even when it opens in a
// different browser than the one that requested it — e.g. tapping a reset link
// from an installed app, which opens in Safari, or on another device.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (token_hash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('That link is invalid or has expired. Please request a new one.')}`
  );
}
