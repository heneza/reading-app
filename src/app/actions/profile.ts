'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// Clean a text field: trim, and turn empty strings into null.
function clean(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

export async function updateProfile(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('profiles')
    .update({
      display_name: clean(formData.get('display_name')),
      bio: clean(formData.get('bio')),
      website: clean(formData.get('website')),
      twitter: clean(formData.get('twitter')),
      instagram: clean(formData.get('instagram')),
    })
    .eq('id', user.id);

  const { data: p } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  redirect(`/u/${p?.username ?? ''}`);
}
