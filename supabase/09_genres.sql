-- =====================================================================
-- Increment: Genres
--   genres          — the fixed taxonomy (seeded below)
--   book_genres     — which genres a book belongs to (auto-classified)
--   profile_genres  — the genres a user says they like (shown on profile)
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

create table if not exists public.genres (
  slug text primary key,
  name text not null,
  sort int  not null default 0
);

create table if not exists public.book_genres (
  book_id uuid not null references public.books(id)  on delete cascade,
  genre   text not null references public.genres(slug) on delete cascade,
  primary key (book_id, genre)
);

create table if not exists public.profile_genres (
  user_id uuid not null references public.profiles(id) on delete cascade,
  genre   text not null references public.genres(slug) on delete cascade,
  primary key (user_id, genre)
);

-- Row Level Security ---------------------------------------------------
alter table public.genres         enable row level security;
alter table public.book_genres    enable row level security;
alter table public.profile_genres enable row level security;

-- genres: read-only catalogue, public.
drop policy if exists "genres_select_all" on public.genres;
create policy "genres_select_all" on public.genres for select using (true);

-- book_genres: anyone can read; any signed-in user can add tags
-- (classification runs server-side as the signed-in user).
drop policy if exists "book_genres_select_all" on public.book_genres;
create policy "book_genres_select_all" on public.book_genres for select using (true);
drop policy if exists "book_genres_insert_auth" on public.book_genres;
create policy "book_genres_insert_auth" on public.book_genres
  for insert to authenticated with check (true);

-- profile_genres: public read; you only edit your own.
drop policy if exists "profile_genres_select_all" on public.profile_genres;
create policy "profile_genres_select_all" on public.profile_genres for select using (true);
drop policy if exists "profile_genres_all_own" on public.profile_genres;
create policy "profile_genres_all_own" on public.profile_genres for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed the genre taxonomy ---------------------------------------------
insert into public.genres (slug, name, sort) values
  ('literary-fiction',      'Literary Fiction',        10),
  ('classics',              'Classics',                20),
  ('contemporary',          'Contemporary Fiction',    30),
  ('historical-fiction',    'Historical Fiction',      40),
  ('mystery-crime',         'Mystery & Crime',         50),
  ('thriller',              'Thriller & Suspense',     60),
  ('horror',                'Horror',                  70),
  ('science-fiction',       'Science Fiction',         80),
  ('fantasy',               'Fantasy',                 90),
  ('romance',               'Romance',                100),
  ('young-adult',           'Young Adult',            110),
  ('childrens',             'Children''s',            120),
  ('poetry',                'Poetry',                 130),
  ('drama',                 'Drama & Plays',          140),
  ('short-stories',         'Short Stories',          150),
  ('graphic-novels',        'Comics & Graphic Novels',160),
  ('letters',               'Letters & Diaries',      170),
  ('essays',                'Essays',                 180),
  ('biography-memoir',      'Biography & Memoir',     190),
  ('history',               'History',                200),
  ('philosophy',            'Philosophy',             210),
  ('psychology',            'Psychology',             220),
  ('self-help',             'Self-Help',              230),
  ('science-nature',        'Science & Nature',       240),
  ('society-politics',      'Society & Politics',     250),
  ('religion-spirituality', 'Religion & Spirituality',260),
  ('travel',                'Travel',                 270),
  ('art-design',            'Art & Design',           280),
  ('business-economics',    'Business & Economics',   290)
on conflict (slug) do update
  set name = excluded.name, sort = excluded.sort;
