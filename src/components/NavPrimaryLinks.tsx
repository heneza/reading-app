'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavPrimaryLinks({ username }: { username?: string | null }) {
  const pathname = usePathname();
  const onOwnProfile = !!username && pathname === `/u/${username}`;

  return (
    <>
      {!onOwnProfile && (
        <>
          <Link
            href="/clubs"
            className="hidden rounded-full px-2.5 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand min-[440px]:inline-flex sm:px-3"
          >
            Clubs
          </Link>
          <Link
            href="/lists"
            className="hidden rounded-full px-2.5 py-1.5 text-slate-600 transition hover:bg-brand-soft hover:text-brand min-[360px]:inline-flex sm:px-3"
          >
            Lists
          </Link>
        </>
      )}
    </>
  );
}
