import Link from 'next/link';
import { coverUrl } from '@/lib/openlibrary';
import BookCoverImage from '@/components/BookCoverImage';

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
          const fallback = (it.title ?? 'Book').slice(0, 34);
          return (
            <Link key={`${it.bookId}-${i}`} href={`/book/${it.bookId}`} title={it.title ?? ''} className="block w-[92px] flex-shrink-0">
              <div className="book-cover-fallback aspect-[2/3] w-full overflow-hidden rounded transition hover:opacity-90">
                <span aria-hidden="true" className="absolute inset-2 z-0 flex items-center justify-center overflow-hidden text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-stone-600">
                  {fallback}
                </span>
                <BookCoverImage src={src} alt={it.title ?? ''} width={184} height={276} className="relative z-10 h-full w-full object-cover" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
