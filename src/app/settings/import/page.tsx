import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import GoodreadsImport from '../GoodreadsImport';

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
      <h1 className="mb-1 mt-2 text-2xl font-bold">Import from Goodreads</h1>
      <p className="mb-6 text-sm text-stone-500">Bring your shelves, ratings and reviews over.</p>

      <ol className="mb-6 list-decimal space-y-1 pl-5 text-sm text-stone-600">
        <li>On Goodreads, go to <span className="font-medium">My Books → Import/Export</span>.</li>
        <li>Click <span className="font-medium">Export Library</span> and wait for the CSV to be generated, then download it.</li>
        <li>Upload that CSV here.</li>
      </ol>

      <GoodreadsImport username={profile?.username ?? ''} />

      <p className="mt-6 text-xs text-stone-400">
        Books are matched to Open Library by ISBN (with a title/author fallback). Unmatched books are still
        added with their title and author, just without a cover. Your Goodreads shelves map to Want to read /
        Reading / Read.
      </p>
    </div>
  );
}
