-- =====================================================================
-- Increment #4c: replies (comments) on reviews
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

create table if not exists public.review_comments (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.reviews(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

alter table public.review_comments enable row level security;

drop policy if exists "comments_select_all" on public.review_comments;
create policy "comments_select_all" on public.review_comments for select using (true);

drop policy if exists "comments_all_own" on public.review_comments;
create policy "comments_all_own" on public.review_comments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
