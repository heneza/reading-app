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

const themeScript = `
try {
  var stored = localStorage.getItem('reading-app-theme');
  var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
} catch (_) {
  document.documentElement.dataset.theme = 'dark';
}
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let viewerProfile: {
    username: string | null;
    avatar_url: string | null;
    display_name: string | null;
    ai_enabled: boolean | null;
  } | null = null;
  let aiEnabled = true;
  if (user) {
    const { data: meProf } = await supabase
      .from('profiles')
      .select('username, avatar_url, display_name, ai_enabled')
      .eq('id', user.id)
      .maybeSingle();
    viewerProfile = meProf ?? null;
    aiEnabled = meProf?.ai_enabled !== false;
  }
  return (
    <html lang="en" className={bodyFont.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <Nav viewerId={user?.id ?? null} profile={viewerProfile} />
        <main className="mx-auto max-w-[880px] px-5 py-8">{children}</main>
        {user && aiEnabled && <Assistant />}
        {user && <RealtimeNotifications meId={user.id} />}
      </body>
    </html>
  );
}
