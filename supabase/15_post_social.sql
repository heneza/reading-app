-- =====================================================================
-- Increment: post interactions + profile privacy
--   posts.body_text         : plain text, for keyword search
--   post_reactions          : like / dislike on a post
--   post_comments           : comments on a post
--   post_reposts            : reposting a post onto your profile
--   profiles.likes_visibility / comments_visibility : who can see your
--                             liked-posts and comment history on your profile
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

alter table public.posts
  add column if not exists body_text text not null default '';

alter table public.profiles
  add column if not exists likes_visibility    text not null default 'public'
    check (likes_visibility in ('public', 'friends', 'private')),
  add column if not exists comments_visibility text not null default 'public'
    check (comments_visibility in ('public', 'friends', 'private'));

create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id)    on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type    text not null check (type in ('like', 'dislike')),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id)    on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.post_reposts (
  post_id    uuid not null references public.posts(id)    on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_comments_post_idx on public.post_comments (post_id);
create index if not exists post_reposts_user_idx  on public.post_reposts (user_id);
create index if not exists posts_body_text_idx    on public.posts using gin (to_tsvector('simple', body_text));

alter table public.post_reactions enable row level security;
alter table public.post_comments  enable row level security;
alter table public.post_reposts   enable row level security;

-- Reactions: public read, manage your own.
drop policy if exists "post_reactions_select" on public.post_reactions;
create policy "post_reactions_select" on public.post_reactions for select using (true);
drop policy if exists "post_reactions_own" on public.post_reactions;
create policy "post_reactions_own" on public.post_reactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Comments: public read, create/delete your own.
drop policy if exists "post_comments_select" on public.post_comments;
create policy "post_comments_select" on public.post_comments for select using (true);
drop policy if exists "post_comments_insert" on public.post_comments;
create policy "post_comments_insert" on public.post_comments for insert
  with check (auth.uid() = user_id);
drop policy if exists "post_comments_delete" on public.post_comments;
create policy "post_comments_delete" on public.post_comments for delete
  using (auth.uid() = user_id);

-- Reposts: public read, manage your own.
drop policy if exists "post_reposts_select" on public.post_reposts;
create policy "post_reposts_select" on public.post_reposts for select using (true);
drop policy if exists "post_reposts_own" on public.post_reposts;
create policy "post_reposts_own" on public.post_reposts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
