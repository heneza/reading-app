-- =====================================================================
-- Increment: notifications + admin article review
--   notifications : per-user inbox of events
--     'article_pending'  -> to founders, when someone submits an article
--     'article_approved' -> to the author, when a founder approves
--     'article_rejected' -> to the author, when a founder rejects (deletes)
--   + founders can delete any post (to reject articles)
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  actor_id   uuid references public.profiles(id) on delete set null,
  post_id    uuid references public.posts(id) on delete cascade,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, read);

alter table public.notifications enable row level security;

-- You only read your own notifications.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select
  using (auth.uid() = user_id);

-- Any signed-in user can create a notification (author -> founders, founder -> author).
drop policy if exists "notifications_insert_auth" on public.notifications;
create policy "notifications_insert_auth" on public.notifications for insert
  to authenticated with check (true);

-- You can mark your own notifications read.
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Founders can delete any post (used to reject an article).
drop policy if exists "posts_admin_delete" on public.posts;
create policy "posts_admin_delete" on public.posts for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Make both founders admins (covers either username Niki picked).
update public.profiles set is_admin = true
where username in ('nesha', 'niki', 'nikistruga111');
