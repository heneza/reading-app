import Link from 'next/link';
import Image from 'next/image';
import { coverUrl } from '@/lib/openlibrary';

type Item = { bookId: string; title?: string | null; coverId?: number | null };

// Pure-CSS infinite marquee. Items are rendered twice so the loop is seamless.
export default function BookMarquee({ items, reverse = false }: { items: Item[]; reverse?: boolean }) {
  if (items.length === 0) return null;
  const doubled = [...items, ...items];
  return (
    <div className="marquee">
      <div className={`marquee-track${reverse ? ' rev' : ''}`}>
        {doubled.map((it, i) => {
          const src = coverUrl(it.coverId, 'M');
          return (
            <Link key={`${it.bookId}-${i}`} href={`/book/${it.bookId}`} title={it.title ?? ''} className="block w-[92px] flex-shrink-0">
              <div className="aspect-[2/3] w-full overflow-hidden rounded bg-stone-100 transition hover:opacity-90">
                {src && <Image src={src} alt={it.title ?? ''} width={184} height={276} className="h-full w-full object-cover" />}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
