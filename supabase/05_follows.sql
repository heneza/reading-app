-- =====================================================================
-- Increment #3: follows (the social graph)
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)   -- you can't follow yourself
);

alter table public.follows enable row level security;

-- Anyone can read the follow graph (for counts and lists).
drop policy if exists "follows_select_all" on public.follows;
create policy "follows_select_all" on public.follows for select using (true);

-- You may only create/remove follow rows where YOU are the follower.
drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows for delete
  using (auth.uid() = follower_id);
