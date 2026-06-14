-- =====================================================================
-- Increment: book lists
--   lists       : named, optionally-described collections of books.
--                 owner_id NULL + is_system = curated genre lists.
--   list_items  : books in a list (ordered).
--   list_likes  : a user liking a list (shows on their profile).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- Safe to run more than once (idempotent).
-- =====================================================================

create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references public.profiles(id) on delete cascade,  -- null = system
  title       text not null,
  description text,
  genre       text,                       -- slug, for system genre lists
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- One system list per genre.
create unique index if not exists lists_genre_system_idx
  on public.lists (genre) where is_system;

create table if not exists public.list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, book_id)
);
create index if not exists list_items_list_idx on public.list_items (list_id, position);

create table if not exists public.list_likes (
  list_id    uuid not null references public.lists(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index if not exists list_likes_user_idx on public.list_likes (user_id);

alter table public.lists      enable row level security;
alter table public.list_items enable row level security;
alter table public.list_likes enable row level security;

-- helper: is the current user an admin/founder?
-- (inlined in policies below)

-- Lists: public-read; you write your own; admins also manage system lists.
drop policy if exists "lists_select_all" on public.lists;
create policy "lists_select_all" on public.lists for select using (true);

drop policy if exists "lists_insert" on public.lists;
create policy "lists_insert" on public.lists for insert with check (
  owner_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

drop policy if exists "lists_update" on public.lists;
create policy "lists_update" on public.lists for update using (
  owner_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

drop policy if exists "lists_delete" on public.lists;
create policy "lists_delete" on public.lists for delete using (
  owner_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

-- List items: public-read; writable by the list's owner (or admins).
drop policy if exists "list_items_select_all" on public.list_items;
create policy "list_items_select_all" on public.list_items for select using (true);

drop policy if exists "list_items_write" on public.list_items;
create policy "list_items_write" on public.list_items for all using (
  exists (
    select 1 from public.lists l
    where l.id = list_id
      and (l.owner_id = auth.uid()
           or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  )
) with check (
  exists (
    select 1 from public.lists l
    where l.id = list_id
      and (l.owner_id = auth.uid()
           or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  )
);

-- Likes: public-read; you add/remove your own.
drop policy if exists "list_likes_select_all" on public.list_likes;
create policy "list_likes_select_all" on public.list_likes for select using (true);
drop policy if exists "list_likes_insert_own" on public.list_likes;
create policy "list_likes_insert_own" on public.list_likes for insert with check (auth.uid() = user_id);
drop policy if exists "list_likes_delete_own" on public.list_likes;
create policy "list_likes_delete_own" on public.list_likes for delete using (auth.uid() = user_id);
