import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import LibraryImport from '../LibraryImport';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/settings" className="text-sm text-stone-400 hover:text-brand">← Settings</Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Import your library</h1>
      <p className="mb-6 text-sm text-stone-500">From Goodreads, StoryGraph, or Hardcover — shelves, ratings and reviews.</p>

      <div className="mb-6 space-y-3 text-sm text-stone-600">
        <div>
          <p className="font-medium text-stone-700">Goodreads</p>
          <p>My Books → Import/Export → <span className="font-medium">Export Library</span> → download the CSV.</p>
        </div>
        <div>
          <p className="font-medium text-stone-700">StoryGraph</p>
          <p>Manage Account → Manage Your Data → <span className="font-medium">Export StoryGraph Library</span> → download the CSV.</p>
        </div>
        <div>
          <p className="font-medium text-stone-700">Hardcover</p>
          <p>Account → Exports (hardcover.app/account/exports) → download your data. Hardcover exports <span className="font-medium">JSON</span>, which this importer also accepts.</p>
        </div>
      </div>

      <LibraryImport username={profile?.username ?? ''} />

      <p className="mt-6 text-xs text-stone-400">
        Books are matched to Open Library by ISBN (with a title/author fallback). Unmatched books are still
        added with their title and author, just without a cover. Statuses map to Want to read / Reading / Read /
        Did not finish, and half-star ratings are kept.
      </p>
    </div>
  );
}
