import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// OAuth redirect target: exchanges the ?code for a session, then sends the
// user home. Add this URL to Supabase -> Authentication -> URL Configuration.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // First-time OAuth users go through the same /welcome onboarding.
      const { data: { user } } = await supabase.auth.getUser();
      let dest = next;
      if (user && !next.startsWith('/reset-password')) {
        const { data: p } = await supabase.from('profiles').select('onboarded').eq('id', user.id).maybeSingle();
        if (p && p.onboarded === false) dest = '/welcome';
      }
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Could not sign in. Please try again.')}`);
}
