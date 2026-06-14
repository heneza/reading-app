-- =====================================================================
-- Increment: reading goals + logged reading time
--   reading_goals    : per user, per year targets (books + hours)
--   reading_sessions : each logged chunk of reading time (manual entry
--                      or the on-profile pomodoro timer). Hours this year
--                      = sum of this year's session rows.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- Safe to run more than once (idempotent).
-- =====================================================================

create table if not exists public.reading_goals (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  year       int  not null,
  books_goal int  not null default 0,
  hours_goal numeric(6,1) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, year)
);

create table if not exists public.reading_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  hours      numeric(5,2) not null check (hours > 0 and hours <= 24),
  source     text not null default 'manual' check (source in ('manual', 'timer')),
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_year_idx
  on public.reading_sessions (user_id, created_at desc);

alter table public.reading_goals    enable row level security;
alter table public.reading_sessions enable row level security;

-- Goals + sessions are public-read (so the goal bars render on any profile),
-- but you can only write your own.
drop policy if exists "goals_select_all" on public.reading_goals;
create policy "goals_select_all" on public.reading_goals for select using (true);
drop policy if exists "goals_write_own" on public.reading_goals;
create policy "goals_write_own" on public.reading_goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sessions_select_all" on public.reading_sessions;
create policy "sessions_select_all" on public.reading_sessions for select using (true);
drop policy if exists "sessions_insert_own" on public.reading_sessions;
create policy "sessions_insert_own" on public.reading_sessions for insert
  with check (auth.uid() = user_id);
drop policy if exists "sessions_delete_own" on public.reading_sessions;
create policy "sessions_delete_own" on public.reading_sessions for delete
  using (auth.uid() = user_id);
