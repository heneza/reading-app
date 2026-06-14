-- =====================================================================
-- Increment: reading diary (Letterboxd-style dated read log)
--   diary_entries : one row PER reading session (not per book), so a
--                   book can be logged many times → reread count is just
--                   how many rows you have for that book.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- Safe to run more than once (idempotent).
-- =====================================================================

create table if not exists public.diary_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id)    on delete cascade,
  read_on    date not null default current_date,   -- the day you read it
  rating     numeric(3,2),                          -- optional, 0.25 .. 5.00
  note       text,                                  -- optional short note
  is_reread  boolean not null default false,        -- true if you'd logged it before
  created_at timestamptz not null default now()
);

create index if not exists diary_user_idx    on public.diary_entries (user_id);
create index if not exists diary_book_idx     on public.diary_entries (book_id);
create index if not exists diary_read_on_idx  on public.diary_entries (user_id, read_on desc);

alter table public.diary_entries enable row level security;

-- Diary is public-read (so it shows on profiles / activity), like reviews.
drop policy if exists "diary_select_all" on public.diary_entries;
create policy "diary_select_all" on public.diary_entries for select using (true);

-- You can only create / change / delete your own diary rows.
drop policy if exists "diary_insert_own" on public.diary_entries;
create policy "diary_insert_own" on public.diary_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "diary_update_own" on public.diary_entries;
create policy "diary_update_own" on public.diary_entries for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "diary_delete_own" on public.diary_entries;
create policy "diary_delete_own" on public.diary_entries for delete
  using (auth.uid() = user_id);
