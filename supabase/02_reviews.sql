-- =====================================================================
-- Increment #1: Reviews
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  body       text not null,
  spoiler    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, book_id)        -- one review per user per book
);

alter table public.reviews enable row level security;

-- Reviews are public content: anyone can read them...
drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all" on public.reviews for select using (true);

-- ...but you can only create/edit/delete your own.
drop policy if exists "reviews_all_own" on public.reviews;
create policy "reviews_all_own" on public.reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
