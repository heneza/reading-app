'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

async function revalidateMine(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: me } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle();
  if (me?.username) revalidatePath(`/u/${me.username}`);
  revalidatePath('/goals');
}

// Set this year's reading targets (books + hours).
export async function setReadingGoals(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const year = new Date().getFullYear();
  const booksGoal = Math.max(0, Math.floor(Number(formData.get('booksGoal')) || 0));
  const hoursGoal = Math.max(0, Number(formData.get('hoursGoal')) || 0);

  await supabase.from('reading_goals').upsert(
    { user_id: user.id, year, books_goal: booksGoal, hours_goal: hoursGoal, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,year' }
  );
  await revalidateMine(supabase, user.id);
}

// Log a chunk of reading time. Timer sessions are capped at 3h; manual at 24h.
export async function logReadingHours(hours: number, source: 'timer' | 'manual'): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const cap = source === 'timer' ? 3 : 24;
  const h = Math.max(0, Math.min(cap, Number(hours) || 0));
  if (h <= 0) return;

  await supabase.from('reading_sessions').insert({ user_id: user.id, hours: Number(h.toFixed(2)), source });
  await revalidateMine(supabase, user.id);
}

// Manual "add hours" form handler.
export async function addReadingHours(formData: FormData) {
  const hours = Number(formData.get('hours'));
  await logReadingHours(hours, 'manual');
}
