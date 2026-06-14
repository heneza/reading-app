'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { importGoodreadsBatch, type GoodreadsRow } from '@/app/actions/import';

function val(obj: any, keys: string[]) {
  for (const k of Object.keys(obj)) {
    if (keys.includes(k.toLowerCase().trim())) {
      const v = obj[k];
      if (v != null && v !== '') return v;
    }
  }
  return undefined;
}
function asAuthor(v: any): string {
  if (!v) return '';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : x?.name || x?.author || '')).filter(Boolean).join(', ');
  return String(v);
}
function toRating(v: any): number {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  if (!n || n <= 0) return 0;
  return Math.min(5, Math.round(n * 2) / 2);
}
function extract(raw: any): GoodreadsRow {
  const obj = raw && typeof raw === 'object' && raw.book && typeof raw.book === 'object' ? { ...raw.book, ...raw } : raw;
  return {
    title: String(val(obj, ['title', 'book title', 'name']) || '').trim(),
    author: asAuthor(val(obj, ['author', 'authors', 'author l-f', 'contributors'])).trim(),
    isbn: String(val(obj, ['isbn13', 'isbn', 'isbn/uid', 'isbn_13']) || '').replace(/[^0-9Xx]/g, ''),
    rating: toRating(val(obj, ['my rating', 'star rating', 'rating', 'user_rating'])),
    shelf: String(val(obj, ['exclusive shelf', 'read status', 'status', 'shelf', 'bookshelves']) || '').trim(),
    review: String(val(obj, ['my review', 'review', 'review_text']) || '').trim(),
  };
}
function rowsFromJson(data: any): any[] {
  if (Array.isArray(data)) return data;
  for (const k of ['books', 'user_books', 'userBooks', 'library', 'entries', 'data', 'reads']) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  for (const v of Object.values(data || {})) if (Array.isArray(v)) return v as any[];
  return [];
}

export default function LibraryImport({ username }: { username: string }) {
  const [withReviews, setWithReviews] = useState(true);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [imported, setImported] = useState(0);
  const [noCover, setNoCover] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function run(rows: GoodreadsRow[]) {
    const clean = rows.filter((r) => r.title);
    if (!clean.length) {
      setError('No books found in that file. Use a Goodreads/StoryGraph CSV or a Hardcover JSON export.');
      return;
    }
    setTotal(clean.length);
    setDone(0); setImported(0); setNoCover(0); setSkipped(0);
    setStatus('running');
    let imp = 0, nc = 0, sk = 0;
    for (let i = 0; i < clean.length; i += 8) {
      try {
        const r = await importGoodreadsBatch(clean.slice(i, i + 8), withReviews);
        imp += r.imported; nc += r.noCover; sk += r.skipped;
      } catch (err: any) {
        setError(err?.message ?? 'Import error');
      }
      setDone(Math.min(i + 8, clean.length));
      setImported(imp); setNoCover(nc); setSkipped(sk);
      await new Promise((r) => setTimeout(r, 150));
    }
    setStatus('done');
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
    if (isJson) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          run(rowsFromJson(data).map(extract));
        } catch {
          setError('That JSON file could not be read.');
        }
      };
      reader.readAsText(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => run((res.data as any[]).map(extract)),
        error: () => setError('Could not read that file.'),
      });
    }
  }

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" checked={withReviews} onChange={(e) => setWithReviews(e.target.checked)} disabled={status === 'running'} />
        Also import my written reviews
      </label>

      <label className="inline-block cursor-pointer rounded bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark">
        {status === 'running' ? 'Importing…' : 'Choose CSV or JSON file'}
        <input type="file" accept=".csv,.json,text/csv,application/json" onChange={onFile} disabled={status === 'running'} className="hidden" />
      </label>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {status !== 'idle' && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-stone-600">
            {status === 'running' ? `Importing ${done} / ${total}…` : `Done — imported ${imported} book${imported === 1 ? '' : 's'}.`}{' '}
            {noCover > 0 && <span className="text-stone-400">({noCover} without a cover)</span>}
            {skipped > 0 && <span className="text-stone-400"> · {skipped} skipped</span>}
          </p>
          {status === 'done' && (
            <a href={`/u/${username}?tab=shelf`} className="mt-1 inline-block text-sm text-brand hover:underline">View your shelf →</a>
          )}
        </div>
      )}
    </div>
  );
}
