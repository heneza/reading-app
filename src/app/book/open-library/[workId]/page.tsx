import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { addToShelf } from '@/app/actions/shelf';
import PendingButton from '@/components/PendingButton';
import BookCoverImage from '@/components/BookCoverImage';
import { coverUrl, fetchWorkDetails } from '@/lib/openlibrary';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function OpenLibraryBookPage({
  params,
  searchParams,
}: {
  params: { workId: string };
  searchParams: { title?: string; author?: string; coverId?: string };
}) {
  const workId = decodeURIComponent(params.workId).replace(/^\/?works\//, '');
  if (!/^OL\d+W$/.test(workId)) notFound();

  const olKey = `/works/${workId}`;
  const supabase = createClient();
  const [{ data: userRes }, { data: cached }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('books').select('id').eq('ol_key', olKey).maybeSingle(),
  ]);

  if (cached?.id) redirect(`/book/${cached.id}`);

  const details = await fetchWorkDetails(olKey);
  const title = details?.title || searchParams.title || 'Untitled book';
  const author = details?.author || searchParams.author || '';
  const coverId = details?.coverId ?? (searchParams.coverId ? Number(searchParams.coverId) : undefined);
  const cover = coverUrl(Number.isFinite(coverId) ? coverId : undefined, 'L');
  const subjects = (details?.subjects ?? []).slice(0, 12);

  return (
    <div className="space-y-8">
      <Link href="/search" className="text-sm text-stone-400 hover:text-brand">
        Back to search
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="book-cover-fallback h-[240px] w-[160px] flex-shrink-0 overflow-hidden rounded">
          <BookCoverImage src={cover} alt={title} width={160} height={240} className="relative z-10 h-full w-full object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-slate-500">{author || 'Unknown author'}</p>

          {subjects.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <span key={subject} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
                  {subject}
                </span>
              ))}
            </div>
          )}

          {details?.description ? (
            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {details.description.length > 900
                ? `${details.description.slice(0, 900).trimEnd()}...`
                : details.description}
            </p>
          ) : (
            <p className="mt-5 text-sm leading-relaxed text-slate-500">
              Description is not available yet, but you can still add this book to your shelf.
            </p>
          )}

          {userRes.user ? (
            <form action={addToShelf} className="mt-6 flex flex-wrap items-center gap-2">
              <input type="hidden" name="olKey" value={olKey} />
              <input type="hidden" name="title" value={title} />
              <input type="hidden" name="author" value={author} />
              <input type="hidden" name="coverId" value={coverId ?? ''} />
              <select name="status" defaultValue="read" className="rounded border border-slate-300 px-2 py-1.5 text-sm">
                <option value="want_to_read">Want to read</option>
                <option value="reading">Reading</option>
                <option value="read">Read</option>
                <option value="dnf">DNF</option>
              </select>
              <PendingButton pendingLabel="Adding..." className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Add to shelf
              </PendingButton>
            </form>
          ) : (
            <p className="mt-6 text-sm text-slate-400">
              <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link> to add this book to your shelf.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
