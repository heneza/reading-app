-- =====================================================================
-- Reading App — Proof of Concept schema
-- Run this in the Supabase dashboard:  SQL Editor -> New query -> Run
-- Safe to run more than once (idempotent).
-- =====================================================================

-- Reading status enum -------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'reading_status') then
    create type reading_status as enum ('want_to_read', 'reading', 'read', 'dnf');
  end if;
end $$;

-- Profiles (1:1 with auth.users) -------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique,
  display_name text,
  bio          text,
  created_at   timestamptz not null default now()
);

-- Book catalogue cache (shared) --------------------------------------
-- We cache the minimal book data we pull from Open Library so reading
-- entries can reference a stable internal id.
create table if not exists public.books (
  id         uuid primary key default gen_random_uuid(),
  ol_key     text unique not null,           -- Open Library work key
  title      text not null,
  author     text,
  cover_id   integer,
  created_at timestamptz not null default now()
);

-- A user's relationship to a book ------------------------------------
create table if not exists public.reading_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  status     reading_status not null default 'want_to_read',
  rating     numeric(2,1),                   -- 0.5 .. 5.0
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

-- Row Level Security --------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.books           enable row level security;
alter table public.reading_entries enable row level security;

-- Profiles: readable by all, writable only by owner
drop policy if exists "profiles_select_all"   on public.profiles;
drop policy if exists "profiles_insert_own"   on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Books: shared catalogue — readable by all, writable by any signed-in user
drop policy if exists "books_select_all"          on public.books;
drop policy if exists "books_insert_authenticated" on public.books;
drop policy if exists "books_update_authenticated" on public.books;
create policy "books_select_all"          on public.books for select using (true);
create policy "books_insert_authenticated" on public.books for insert to authenticated with check (true);
create policy "books_update_authenticated" on public.books for update to authenticated using (true);

-- Reading entries: a user only sees / edits their own (for the PoC).
-- NOTE: in v1 you will relax SELECT so followers can see each other's
-- activity for the social feed.
drop policy if exists "entries_select_own" on public.reading_entries;
drop policy if exists "entries_all_own"    on public.reading_entries;
create policy "entries_select_own" on public.reading_entries for select using (auth.uid() = user_id);
create policy "entries_all_own"    on public.reading_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile row when a new auth user signs up ------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
