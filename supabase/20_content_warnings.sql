-- =====================================================================
-- Increment: content warnings (community-contributed, per book)
--   content_warnings : each row = one user flagging one warning on one
--                      book. We aggregate them on the book page (distinct
--                      warning + how many users flagged it).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- Safe to run more than once (idempotent).
-- =====================================================================

create table if not exists public.content_warnings (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books(id)    on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  warning    text not null,
  created_at timestamptz not null default now(),
  unique (book_id, user_id, warning)   -- a user can't flag the same warning twice
);

create index if not exists cw_book_idx on public.content_warnings (book_id);

alter table public.content_warnings enable row level security;

-- Public-read (warnings are meant to be seen); you write only your own.
drop policy if exists "cw_select_all" on public.content_warnings;
create policy "cw_select_all" on public.content_warnings for select using (true);

drop policy if exists "cw_insert_own" on public.content_warnings;
create policy "cw_insert_own" on public.content_warnings for insert
  with check (auth.uid() = user_id);

drop policy if exists "cw_delete_own" on public.content_warnings;
create policy "cw_delete_own" on public.content_warnings for delete
  using (auth.uid() = user_id);
