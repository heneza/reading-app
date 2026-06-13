-- =====================================================================
-- Increment: Favourite books (a Letterboxd-style "Top 4")
--   favorite_books — up to 4 ordered books a user features on their profile
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

create table if not exists public.favorite_books (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  book_id  uuid not null references public.books(id)    on delete cascade,
  position int  not null check (position between 1 and 4),
  primary key (user_id, position),
  unique (user_id, book_id)
);

alter table public.favorite_books enable row level security;

-- Public read (shown on profiles); you only edit your own.
drop policy if exists "favorite_books_select_all" on public.favorite_books;
create policy "favorite_books_select_all" on public.favorite_books for select using (true);

drop policy if exists "favorite_books_all_own" on public.favorite_books;
create policy "favorite_books_all_own" on public.favorite_books for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
