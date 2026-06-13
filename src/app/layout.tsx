import type { Metadata } from 'next';
import { Source_Serif_4 } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={bodyFont.variable}>
      <body className="font-sans">
        <Nav />
        <main className="mx-auto max-w-[880px] px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
