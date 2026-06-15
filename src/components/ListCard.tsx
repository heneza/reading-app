import Link from 'next/link';
import Image from 'next/image';
import { coverUrl } from '@/lib/openlibrary';

export default function ListCard({
  id,
  title,
  subtitle,
  count,
  likeCount,
  covers,
}: {
  id: string;
  title: string;
  subtitle?: string;
  count?: number;
  likeCount?: number;
  covers: (number | null | undefined)[];
}) {
  const meta = [subtitle, count != null ? `${count} book${count === 1 ? '' : 's'}` : null, likeCount ? `♥ ${likeCount}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Link
      href={`/list/${id}`}
      className="group block rounded-xl border border-stone-200 bg-white p-3 transition hover:border-brand/40 hover:shadow-card"
    >
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => {
          const src = coverUrl(covers[i] ?? null, 'M');
          return (
            <div key={i} className="book-cover-fallback aspect-[2/3] w-1/3 overflow-hidden rounded">
              <span aria-hidden="true" className="absolute inset-2 z-0 flex items-center justify-center text-center text-xs font-semibold text-stone-600">
                {i + 1}
              </span>
              {src && <Image src={src} alt="" width={120} height={180} className="relative z-10 h-full w-full object-cover" />}
            </div>
          );
        })}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-stone-800 group-hover:text-brand">{title}</p>
      {meta && <p className="truncate text-xs text-stone-400">{meta}</p>}
    </Link>
  );
}
