'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { lookupByIsbn, searchBooks } from '@/lib/openlibrary';

export type GoodreadsRow = {
  title: string;
  author: string;
  isbn: string;
  rating: number; // 0–5 (0 = none)
  shelf: string; // Goodreads "Exclusive Shelf"
  review: string;
};

function mapStatus(raw: string): string {
  const s = (raw || '').toLowerCase().trim().replace(/\s+/g, '-');
  if (s === 'read') return 'read';
  if (s.includes('currently') || s === 'reading') return 'reading';
  if (s.includes('did-not-finish') || s === 'dnf' || s.includes('didnt') || s.includes('abandon')) return 'dnf';
  if (s.includes('to-read') || s.includes('want')) return 'want_to_read';
  return 'want_to_read';
}

function syntheticKey(title: string, author: string) {
  return ('gr:' + `${title}-${author}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 180);
}

// Import a small batch of Goodreads rows (the client sends ~8 at a time so
// each call stays well within serverless time limits and shows progress).
export async function importGoodreadsBatch(
  rows: GoodreadsRow[],
  withReviews: boolean
): Promise<{ imported: number; noCover: number; skipped: number }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { imported: 0, noCover: 0, skipped: 0 };

  let imported = 0;
  let noCover = 0;
  let skipped = 0;

  for (const r of rows) {
    if (!r.title) {
      skipped++;
      continue;
    }
    const status = mapStatus(r.shelf);

    // Match against Open Library: ISBN first, then title/author search.
    let ol = r.isbn ? await lookupByIsbn(r.isbn) : null;
    if (!ol) {
      const found = await searchBooks(`${r.title} ${r.author ?? ''}`.trim());
      const d = found[0];
      if (d) ol = { olKey: d.key, title: d.title, coverId: d.coverId };
    }

    let olKey: string;
    let title: string;
    let coverId: number | null;
    if (ol) {
      olKey = ol.olKey;
      title = ol.title || r.title;
      coverId = ol.coverId ?? null;
      if (coverId == null) noCover++;
    } else {
      olKey = syntheticKey(r.title, r.author);
      title = r.title;
      coverId = null;
      noCover++;
    }

    const { data: book } = await supabase
      .from('books')
      .upsert({ ol_key: olKey, title, author: r.author ?? '', cover_id: coverId }, { onConflict: 'ol_key' })
      .select('id')
      .single();
    if (!book) {
      skipped++;
      continue;
    }

    const rating = r.rating && r.rating > 0 ? r.rating : null;
    await supabase
      .from('reading_entries')
      .upsert({ user_id: user.id, book_id: book.id, status, rating }, { onConflict: 'user_id,book_id' });

    if (withReviews && r.review) {
      // Skip if the same review already exists, so re-imports don't duplicate.
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', user.id)
        .eq('book_id', book.id)
        .eq('body', r.review)
        .maybeSingle();
      if (!existingReview) {
        await supabase.from('reviews').insert({ user_id: user.id, book_id: book.id, body: r.review });
      }
    }
    imported++;
  }

  revalidatePath('/');
  return { imported, noCover, skipped };
}
