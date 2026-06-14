import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import ReadingTimer from '@/components/ReadingTimer';
import { setReadingGoals, addReadingHours } from '@/app/actions/goals';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const yearNum = new Date().getFullYear();
  const yearStart = `${yearNum}-01-01`;

  const { data: goalsRow } = await supabase
    .from('reading_goals')
    .select('books_goal, hours_goal')
    .eq('user_id', user.id)
    .eq('year', yearNum)
    .maybeSingle();
  const booksGoal = goalsRow?.books_goal ?? 0;
  const hoursGoal = Number(goalsRow?.hours_goal ?? 0);

  const { data: sessionRows } = await supabase
    .from('reading_sessions')
    .select('hours')
    .eq('user_id', user.id)
    .gte('created_at', yearStart);
  const hoursThisYear = (sessionRows ?? []).reduce((sum: number, r: any) => sum + Number(r.hours), 0);

  const { count: booksCount } = await supabase
    .from('diary_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('read_on', yearStart);
  const booksRead = booksCount ?? 0;

  const pctBooks = booksGoal > 0 ? Math.min(100, (booksRead / booksGoal) * 100) : 0;
  const pctHours = hoursGoal > 0 ? Math.min(100, (hoursThisYear / hoursGoal) * 100) : 0;

  const { data: me } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Reading goals · {yearNum}</h1>
        {me?.username && (
          <Link href={`/u/${me.username}`} className="whitespace-nowrap text-sm text-brand hover:underline">View profile →</Link>
        )}
      </div>
      <p className="mb-6 text-sm text-stone-500">
        Your goal bars are public on your profile. The timer and manual logging below are private to you.
      </p>

      {/* Progress */}
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-stone-600">Books read</span>
            <span className="font-medium text-stone-700">{booksRead} / {booksGoal > 0 ? booksGoal : '—'}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-soft">
            <div className="h-full rounded-full bg-brand" style={{ width: `${pctBooks}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-stone-600">Hours read</span>
            <span className="font-medium text-stone-700">{hoursThisYear.toFixed(1)} / {hoursGoal > 0 ? hoursGoal : '—'}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-soft">
            <div className="h-full rounded-full bg-brand" style={{ width: `${pctHours}%` }} />
          </div>
        </div>
      </section>

      {/* Log reading time */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Log reading time</h2>
        <ReadingTimer />
        <form action={addReadingHours} className="mt-3 flex items-end gap-2">
          <label className="flex flex-col text-xs text-slate-500">
            …or add hours manually
            <input type="number" name="hours" min="0.25" max="24" step="0.25" placeholder="e.g. 1.5" className="mt-1 w-32 rounded border border-slate-300 px-2 py-1 text-sm text-slate-700" />
          </label>
          <button className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100">Add</button>
        </form>
      </section>

      {/* Edit goals */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Targets</h2>
        <form action={setReadingGoals} className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <label className="flex flex-col text-xs text-slate-500">
            Books goal
            <input type="number" name="booksGoal" min="0" step="1" defaultValue={booksGoal || ''} placeholder="e.g. 24" className="mt-1 w-28 rounded border border-slate-300 px-2 py-1 text-sm text-slate-700" />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Hours goal
            <input type="number" name="hoursGoal" min="0" step="1" defaultValue={hoursGoal || ''} placeholder="e.g. 100" className="mt-1 w-28 rounded border border-slate-300 px-2 py-1 text-sm text-slate-700" />
          </label>
          <button className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">Save goals</button>
        </form>
      </section>
    </div>
  );
}
