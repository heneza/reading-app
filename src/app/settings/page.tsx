import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { updateProfile } from '@/app/actions/profile';

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
    </div>
  );
}
