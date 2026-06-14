import type { Metadata } from 'next';
import { Source_Serif_4 } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import Assistant from '@/components/Assistant';
import RealtimeNotifications from '@/components/RealtimeNotifications';
import { createClient } from '@/utils/supabase/server';

// The warm, readable serif Claude's replies are set in (free stand-in for
// the proprietary Tiempos). Exposed as --font-sans, which tailwind's
// `font-sans` points at — so changing this one import re-fonts the app.
const bodyFont = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Reading App',
  description: 'A community for readers',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let friends: { id: string; username: string }[] = [];
  let aiEnabled = true;
  if (user) {
    const [{ data: outRows }, { data: inRows }, { data: meProf }] = await Promise.all([
      supabase.from('follows').select('followee_id').eq('follower_id', user.id),
      supabase.from('follows').select('follower_id').eq('followee_id', user.id),
      supabase.from('profiles').select('ai_enabled').eq('id', user.id).maybeSingle(),
    ]);
    aiEnabled = meProf?.ai_enabled !== false;
    const out = new Set((outRows ?? []).map((r: any) => r.followee_id));
    const friendIds = (inRows ?? []).map((r: any) => r.follower_id).filter((id: string) => out.has(id));
    if (friendIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username').in('id', friendIds);
      friends = (profs ?? []).map((p: any) => ({ id: p.id, username: p.username }));
    }
  }
  return (
    <html lang="en" className={bodyFont.variable}>
      <body className="font-sans">
        <Nav />
        <main className="mx-auto max-w-[880px] px-5 py-8">{children}</main>
        {user && aiEnabled && <Assistant />}
        {user && <RealtimeNotifications meId={user.id} friends={friends} />}
      </body>
    </html>
  );
}
