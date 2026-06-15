import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createQuote, deleteQuote } from '@/app/actions/quotes';
import PendingButton from '@/components/PendingButton';
import { timeAgo } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: { tag?: string; error?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tag = String(searchParams.tag ?? '').trim().toLowerCase().replace(/^#/, '');
  let query = supabase
    .from('quotes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (tag) query = query.contains('tags', [tag]);
  const { data, error } = await query;
  const quotes = data ?? [];
  const tags = Array.from(new Set(quotes.flatMap((q: any) => (Array.isArray(q.tags) ? q.tags : [])))).slice(0, 30);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Quotes</h1>
          <p className="mt-1 text-sm text-stone-500">Save, organize, and write down lines you want to keep.</p>
        </div>
        <Link href="/settings/import" className="whitespace-nowrap text-sm text-brand hover:underline">Import books</Link>
      </div>

      {searchParams.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Quotes need the latest Supabase migration before they can save.
          Run `supabase/31_preferences_quotes.sql`, then refresh this page.
        </div>
      ) : (
        <>
          <form action={createQuote} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
            <textarea
              name="body"
              required
              rows={4}
              maxLength={1000}
              placeholder="Paste a quote or write one of your own..."
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="source_title" placeholder="Book, essay, or source" className="rounded border border-stone-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
              <input name="source_author" placeholder="Author" className="rounded border border-stone-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </div>
            <textarea name="note" rows={2} maxLength={500} placeholder="Note, thought, or context..." className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input name="tags" placeholder="tags, separated, by commas" className="rounded border border-stone-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
              <select name="visibility" defaultValue="private" className="rounded border border-stone-300 px-3 py-2 text-sm">
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
            <div className="flex justify-end">
              <PendingButton pendingLabel="Saving..." className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Save quote
              </PendingButton>
            </div>
          </form>

          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-stone-400">Tags:</span>
              {tags.map((t) => (
                <Link key={t} href={`/quotes?tag=${encodeURIComponent(t)}`} className={`rounded-full px-2 py-0.5 ${tag === t ? 'bg-brand text-white' : 'bg-brand-soft text-brand hover:underline'}`}>
                  #{t}
                </Link>
              ))}
              {tag && <Link href="/quotes" className="text-stone-400 hover:text-brand">clear</Link>}
            </div>
          )}

          {quotes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
              {tag ? `No quotes tagged #${tag}.` : 'No quotes yet.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {quotes.map((quote: any) => (
                <li key={quote.id} className="rounded-lg border border-stone-200 bg-white p-4">
                  <blockquote className="whitespace-pre-wrap text-lg leading-relaxed text-stone-800">
                    &ldquo;{quote.body}&rdquo;
                  </blockquote>
                  {(quote.source_title || quote.source_author) && (
                    <p className="mt-2 text-sm text-stone-500">
                      {quote.source_title && <span className="font-medium text-stone-700">{quote.source_title}</span>}
                      {quote.source_title && quote.source_author && ' - '}
                      {quote.source_author}
                    </p>
                  )}
                  {quote.note && <p className="mt-3 rounded bg-stone-50 p-2 text-sm text-stone-600">{quote.note}</p>}
                  {quote.tags?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quote.tags.map((t: string) => (
                        <Link key={t} href={`/quotes?tag=${encodeURIComponent(t)}`} className="text-xs text-brand hover:underline">#{t}</Link>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between text-xs text-stone-400">
                    <span>{quote.visibility === 'public' ? 'Public' : 'Private'} - {timeAgo(quote.created_at)}</span>
                    <form action={deleteQuote}>
                      <input type="hidden" name="id" value={quote.id} />
                      <PendingButton pendingLabel="..." className="hover:text-red-600">Delete</PendingButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
