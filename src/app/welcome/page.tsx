import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import WelcomeForm from './WelcomeForm';

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: p } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: g } = await supabase.from('profile_genres').select('genre').eq('user_id', user.id);
  const initialGenres = (g ?? []).map((r: any) => r.genre);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Welcome to Reading App</h1>
      <p className="mt-1 text-stone-500">A couple of quick things and your profile is ready.</p>
      <WelcomeForm
        username={p?.username ?? ''}
        defaultName={p?.display_name ?? p?.username ?? ''}
        initialGenres={initialGenres}
      />
    </div>
  );
}
