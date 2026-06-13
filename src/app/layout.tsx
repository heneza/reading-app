import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';

// Clean, Claude-like sans. Exposed as the --font-sans CSS variable that
// tailwind.config.ts points `font-sans` at.
const inter = Inter({
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
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <Nav />
        <main className="mx-auto max-w-[880px] px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
