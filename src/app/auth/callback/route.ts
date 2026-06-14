import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// OAuth redirect target: exchanges the ?code for a session, then sends the
// user home. Add this URL to Supabase -> Authentication -> URL Configuration.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Could not sign in. Please try again.')}`);
}
