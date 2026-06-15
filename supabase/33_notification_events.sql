-- =====================================================================
-- Increment: social notification events
--   - follow notifications
--   - post comment notifications
--   - review reply notifications
--   - admin notifications for new accounts
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

alter table public.notifications
  add column if not exists book_id uuid references public.books(id) on delete cascade,
  add column if not exists review_id uuid references public.reviews(id) on delete cascade,
  add column if not exists post_comment_id uuid references public.post_comments(id) on delete cascade,
  add column if not exists review_comment_id uuid references public.review_comments(id) on delete cascade;

create index if not exists notifications_user_type_created_idx
  on public.notifications (user_id, type, created_at desc);
create index if not exists notifications_book_idx
  on public.notifications (book_id);
create index if not exists notifications_review_idx
  on public.notifications (review_id);

create or replace function public.notify_admins_new_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, actor_id)
  select p.id, 'new_user', new.id
  from public.profiles p
  where p.is_admin = true
    and p.id <> new.id;

  return new;
end $$;

drop trigger if exists aa_notify_admins_new_profile on public.profiles;
create trigger aa_notify_admins_new_profile
  after insert on public.profiles
  for each row execute function public.notify_admins_new_profile();

create or replace function public.notify_followee()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.follower_id <> new.followee_id then
    insert into public.notifications (user_id, type, actor_id)
    values (new.followee_id, 'follow', new.follower_id);
  end if;

  return new;
end $$;

drop trigger if exists aa_notify_followee on public.follows;
create trigger aa_notify_followee
  after insert on public.follows
  for each row execute function public.notify_followee();

create or replace function public.notify_post_owner_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  owner_id uuid;
begin
  select p.user_id into owner_id
  from public.posts p
  where p.id = new.post_id;

  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications (user_id, type, actor_id, post_id, post_comment_id)
    values (owner_id, 'post_comment', new.user_id, new.post_id, new.id);
  end if;

  return new;
end $$;

drop trigger if exists aa_notify_post_owner_comment on public.post_comments;
create trigger aa_notify_post_owner_comment
  after insert on public.post_comments
  for each row execute function public.notify_post_owner_comment();

create or replace function public.notify_review_owner_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  owner_id uuid;
  target_book_id uuid;
begin
  select r.user_id, r.book_id into owner_id, target_book_id
  from public.reviews r
  where r.id = new.review_id;

  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications (user_id, type, actor_id, book_id, review_id, review_comment_id)
    values (owner_id, 'review_comment', new.user_id, target_book_id, new.review_id, new.id);
  end if;

  return new;
end $$;

drop trigger if exists aa_notify_review_owner_comment on public.review_comments;
create trigger aa_notify_review_owner_comment
  after insert on public.review_comments
  for each row execute function public.notify_review_owner_comment();
