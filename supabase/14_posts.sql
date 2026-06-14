-- =====================================================================
-- Increment: posts (Tumblr-style short-form text + articles)
--   profiles.is_admin : reviewers (you) who can approve articles
--   posts             : rich-text posts with tags; long ones are
--                       "articles" that stay pending until approved
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Make the founder an admin (add others the same way).
update public.profiles set is_admin = true where username = 'nesha';

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body_html  text not null,            -- already sanitised before insert
  text_len   int  not null default 0,  -- plain-text length (for the 280 rule)
  is_article boolean not null default false,
  status     text not null default 'published'
             check (status in ('published', 'pending', 'rejected')),
  tags       text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists posts_user_idx    on public.posts (user_id);
create index if not exists posts_created_idx  on public.posts (created_at);
create index if not exists posts_tags_idx     on public.posts using gin (tags);

alter table public.posts enable row level security;

-- Published posts are public. Pending/rejected are visible only to the
-- author and to admins (so you can review them).
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select using (
  status = 'published'
  or auth.uid() = user_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts for delete
  using (auth.uid() = user_id);

-- Admins can update any post (approve / reject) — used by the review tools.
drop policy if exists "posts_admin_update" on public.posts;
create policy "posts_admin_update" on public.posts for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
