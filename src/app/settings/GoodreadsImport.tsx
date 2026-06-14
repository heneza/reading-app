'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { importGoodreadsBatch, type GoodreadsRow } from '@/app/actions/import';

function mapRow(d: any): GoodreadsRow {
  const isbn = String(d['ISBN13'] || d['ISBN'] || '').replace(/[^0-9Xx]/g, '');
  return {
    title: String(d['Title'] || '').trim(),
    author: String(d['Author'] || d['Author l-f'] || '').trim(),
    isbn,
    rating: parseInt(String(d['My Rating'] || '0'), 10) || 0,
    shelf: String(d['Exclusive Shelf'] || '').trim(),
    review: String(d['My Review'] || '').trim(),
  };
}

export default function GoodreadsImport({ username }: { username: string }) {
  const [withReviews, setWithReviews] = useState(true);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [imported, setImported] = useState(0);
  const [noCover, setNoCover] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const rows = (res.data as any[]).map(mapRow).filter((r) => r.title);
        if (!rows.length) {
          setError('No books found — make sure this is the Goodreads library export CSV.');
          return;
        }
        setTotal(rows.length);
        setDone(0);
        setImported(0);
        setNoCover(0);
        setSkipped(0);
        setStatus('running');
        let imp = 0, nc = 0, sk = 0;
        for (let i = 0; i < rows.length; i += 8) {
          try {
            const r = await importGoodreadsBatch(rows.slice(i, i + 8), withReviews);
            imp += r.imported;
            nc += r.noCover;
            sk += r.skipped;
          } catch (err: any) {
            setError(err?.message ?? 'Import error');
          }
          setDone(Math.min(i + 8, rows.length));
          setImported(imp);
          setNoCover(nc);
          setSkipped(sk);
          await new Promise((r) => setTimeout(r, 150));
        }
        setStatus('done');
      },
      error: () => setError('Could not read that file.'),
    });
  }

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" checked={withReviews} onChange={(e) => setWithReviews(e.target.checked)} disabled={status === 'running'} />
        Also import my written reviews
      </label>

      <label className="inline-block cursor-pointer rounded bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark">
        {status === 'running' ? 'Importing…' : 'Choose Goodreads CSV'}
        <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={status === 'running'} className="hidden" />
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
