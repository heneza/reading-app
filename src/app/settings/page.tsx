import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { updateProfile } from '@/app/actions/profile';
import GenrePicker from './GenrePicker';
import FavoritesPicker from './FavoritesPicker';

// Always render fresh (no caching) so data and login state are current.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio, website, twitter, instagram')
    .eq('id', user.id)
    .maybeSingle();

  const { data: myGenres } = await supabase
    .from('profile_genres')
    .select('genre')
    .eq('user_id', user.id);
  const selectedGenres = (myGenres ?? []).map((r: any) => r.genre);

  // Shelf books (to choose favourites from) + current favourites.
  const { data: shelfEntries } = await supabase
    .from('reading_entries')
    .select('book_id, books ( title, cover_id )')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  const shelfBooks = (shelfEntries ?? [])
    .map((e: any) => ({ id: e.book_id, title: e.books?.title, coverId: e.books?.cover_id }))
    .filter((b: any) => b.title);
  const { data: favRows } = await supabase
    .from('favorite_books')
    .select('book_id, position')
    .eq('user_id', user.id)
    .order('position');
  const initialFavorites = (favRows ?? []).map((r: any) => r.book_id);

  const field = 'w-full rounded border border-slate-300 px-3 py-2';

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Edit profile</h1>
      <p className="mb-6 text-sm text-slate-500">@{profile?.username}</p>

      <form action={updateProfile} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Display name</label>
          <input
            name="display_name"
            defaultValue={profile?.display_name ?? ''}
            className={field}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Bio</label>
          <textarea
            name="bio"
            rows={3}
            defaultValue={profile?.bio ?? ''}
            placeholder="A little about you and what you read…"
            className={field}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Website</label>
          <input
            name="website"
            defaultValue={profile?.website ?? ''}
            placeholder="https://…"
            className={field}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Instagram</label>
          <input
            name="instagram"
            defaultValue={profile?.instagram ?? ''}
            placeholder="username (no @)"
            className={field}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">X / Twitter</label>
          <input
            name="twitter"
            defaultValue={profile?.twitter ?? ''}
            placeholder="username (no @)"
            className={field}
          />
        </div>
        <button className="rounded bg-brand px-5 py-2 font-medium text-white hover:opacity-90">
          Save profile
        </button>
      </form>

      <section className="mt-10 border-t border-stone-200 pt-8">
        <h2 className="mb-1 text-lg font-semibold">Favourite genres</h2>
        <p className="mb-4 text-sm text-stone-500">
          Pick the genres you love. They show on your profile and will shape
          your feed.
        </p>
        <GenrePicker initial={selectedGenres} username={profile?.username ?? ''} />
      </section>

      <section className="mt-10 border-t border-stone-200 pt-8">
        <h2 className="mb-1 text-lg font-semibold">Favourite books (top 4)</h2>
        <p className="mb-4 text-sm text-stone-500">
          Pick up to four books from your shelf to feature at the top of your
          profile.
        </p>
        <FavoritesPicker
          shelfBooks={shelfBooks}
          initial={initialFavorites}
          username={profile?.username ?? ''}
        />
      </section>
    </div>
  );
}
