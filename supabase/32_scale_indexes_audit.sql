-- =====================================================================
-- Increment: scale indexes, broader stateless rate limits, and audit logs
--   - Adds targeted B-tree indexes for the app's hottest feed/profile paths.
--   - Adds trigram indexes for local search suggestions.
--   - Extends DB-side insert rate limits so Vercel/Next.js can stay stateless.
--   - Adds privacy-safe audit logging for important user/content mutations.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

-- Trigram search keeps ILIKE suggestions usable as the catalogue grows.
create extension if not exists pg_trgm;

-- --- 1. Hot read-path indexes ----------------------------------------
-- PostgreSQL's default index type is B-tree. These match the order/filter
-- patterns used by profiles, feeds, books, messages, notifications, and search.

create index if not exists profiles_username_trgm_idx
  on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name gin_trgm_ops);
create index if not exists profiles_admin_idx
  on public.profiles (is_admin) where is_admin;

create index if not exists books_title_trgm_idx
  on public.books using gin (title gin_trgm_ops);
create index if not exists books_author_trgm_idx
  on public.books using gin (author gin_trgm_ops);
create index if not exists books_created_idx
  on public.books (created_at desc);

create index if not exists reading_entries_updated_idx
  on public.reading_entries (updated_at desc);
create index if not exists reading_entries_user_status_updated_idx
  on public.reading_entries (user_id, status, updated_at desc);
create index if not exists reading_entries_book_updated_idx
  on public.reading_entries (book_id, updated_at desc);

create index if not exists reviews_book_created_idx
  on public.reviews (book_id, created_at desc);
create index if not exists reviews_user_created_idx
  on public.reviews (user_id, created_at desc);

create index if not exists review_reactions_user_type_idx
  on public.review_reactions (user_id, type);
create index if not exists review_reactions_review_type_idx
  on public.review_reactions (review_id, type);

create index if not exists review_comments_review_created_idx
  on public.review_comments (review_id, created_at);
create index if not exists review_comments_user_created_idx
  on public.review_comments (user_id, created_at desc);

create index if not exists posts_user_created_idx
  on public.posts (user_id, created_at desc);
create index if not exists posts_published_short_created_idx
  on public.posts (created_at desc)
  where status = 'published' and is_article = false;
create index if not exists posts_published_articles_created_idx
  on public.posts (created_at desc)
  where status = 'published' and is_article = true;
create index if not exists posts_status_created_idx
  on public.posts (status, created_at desc);
create index if not exists posts_body_text_trgm_idx
  on public.posts using gin (body_text gin_trgm_ops);

create index if not exists post_reactions_user_type_idx
  on public.post_reactions (user_id, type);
create index if not exists post_reactions_post_type_idx
  on public.post_reactions (post_id, type);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at);
create index if not exists post_comments_user_created_idx
  on public.post_comments (user_id, created_at desc);

create index if not exists post_reposts_post_idx
  on public.post_reposts (post_id);
create index if not exists post_reposts_user_created_idx
  on public.post_reposts (user_id, created_at desc);

create index if not exists follows_followee_follower_idx
  on public.follows (followee_id, follower_id);
create index if not exists follows_follower_created_idx
  on public.follows (follower_id, created_at desc);

create index if not exists messages_sender_recipient_created_idx
  on public.messages (sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_sender_created_idx
  on public.messages (recipient_id, sender_id, created_at desc);
create index if not exists messages_recipient_unread_idx
  on public.messages (recipient_id, created_at desc) where read_at is null;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_created_idx
  on public.notifications (user_id, created_at desc) where read = false;
create index if not exists notifications_actor_created_idx
  on public.notifications (actor_id, created_at desc);

create index if not exists lists_owner_created_idx
  on public.lists (owner_id, created_at desc);
create index if not exists lists_system_genre_idx
  on public.lists (is_system, genre);

create index if not exists list_items_book_idx
  on public.list_items (book_id);
create index if not exists list_likes_list_idx
  on public.list_likes (list_id);
create index if not exists list_likes_user_created_idx
  on public.list_likes (user_id, created_at desc);

create index if not exists favorite_books_book_idx
  on public.favorite_books (book_id);

create index if not exists book_genres_genre_book_idx
  on public.book_genres (genre, book_id);
create index if not exists profile_genres_genre_user_idx
  on public.profile_genres (genre, user_id);

create index if not exists diary_user_read_created_idx
  on public.diary_entries (user_id, read_on desc, created_at desc);
create index if not exists diary_user_book_read_idx
  on public.diary_entries (user_id, book_id, read_on desc);

create index if not exists content_warnings_user_created_idx
  on public.content_warnings (user_id, created_at desc);
create index if not exists content_warnings_book_warning_idx
  on public.content_warnings (book_id, warning);

create index if not exists quotes_public_created_idx
  on public.quotes (created_at desc) where visibility = 'public';
create index if not exists quotes_user_updated_idx
  on public.quotes (user_id, updated_at desc);

create index if not exists blocks_blocked_blocker_idx
  on public.blocks (blocked_id, blocker_id);

-- --- 2. Actor stamps for shared tables -------------------------------
-- These tables do not naturally carry the acting user on each row. Stamping
-- created_by lets one DB trigger rate-limit them without app-server memory.

alter table public.books
  add column if not exists created_by uuid;

alter table public.book_genres
  add column if not exists created_at timestamptz,
  add column if not exists created_by uuid;
alter table public.book_genres alter column created_at set default now();
update public.book_genres
  set created_at = now() - interval '1 day'
  where created_at is null;
alter table public.book_genres alter column created_at set not null;

alter table public.list_items
  add column if not exists created_by uuid;

alter table public.notifications
  add column if not exists created_by uuid;

create or replace function public.stamp_created_by()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists aa_stamp_books_created_by on public.books;
create trigger aa_stamp_books_created_by before insert on public.books
  for each row execute function public.stamp_created_by();

drop trigger if exists aa_stamp_book_genres_created_by on public.book_genres;
create trigger aa_stamp_book_genres_created_by before insert on public.book_genres
  for each row execute function public.stamp_created_by();

drop trigger if exists aa_stamp_list_items_created_by on public.list_items;
create trigger aa_stamp_list_items_created_by before insert on public.list_items
  for each row execute function public.stamp_created_by();

drop trigger if exists aa_stamp_notifications_created_by on public.notifications;
create trigger aa_stamp_notifications_created_by before insert on public.notifications
  for each row execute function public.stamp_created_by();

create index if not exists books_created_by_created_idx
  on public.books (created_by, created_at desc);
create index if not exists book_genres_created_by_created_idx
  on public.book_genres (created_by, created_at desc);
create index if not exists list_items_created_by_created_idx
  on public.list_items (created_by, created_at desc);
create index if not exists notifications_created_by_created_idx
  on public.notifications (created_by, created_at desc);

-- Add timestamps to interaction tables that previously had no insert clock.
-- Existing rows are moved outside the active rate-limit window.
alter table public.post_reactions add column if not exists created_at timestamptz;
alter table public.post_reactions alter column created_at set default now();
update public.post_reactions
  set created_at = now() - interval '1 day'
  where created_at is null;
alter table public.post_reactions alter column created_at set not null;

alter table public.favorite_books add column if not exists created_at timestamptz;
alter table public.favorite_books alter column created_at set default now();
update public.favorite_books
  set created_at = now() - interval '1 day'
  where created_at is null;
alter table public.favorite_books alter column created_at set not null;

alter table public.profile_genres add column if not exists created_at timestamptz;
alter table public.profile_genres alter column created_at set default now();
update public.profile_genres
  set created_at = now() - interval '1 day'
  where created_at is null;
alter table public.profile_genres alter column created_at set not null;

create index if not exists post_reactions_user_created_idx
  on public.post_reactions (user_id, created_at desc);
create index if not exists favorite_books_user_created_idx
  on public.favorite_books (user_id, created_at desc);
create index if not exists profile_genres_user_created_idx
  on public.profile_genres (user_id, created_at desc);

-- --- 3. Broader stateless insert rate limits -------------------------
-- Uses the generic public.rate_limit() trigger from migration 24. These are
-- deliberately generous: they block scripts/spam while keeping normal use calm.

drop trigger if exists rl_books on public.books;
create trigger rl_books before insert on public.books
  for each row execute function public.rate_limit('created_by', '80', '60');

drop trigger if exists rl_reading_entries on public.reading_entries;
create trigger rl_reading_entries before insert on public.reading_entries
  for each row execute function public.rate_limit('user_id', '120', '60');

drop trigger if exists rl_follows on public.follows;
create trigger rl_follows before insert on public.follows
  for each row execute function public.rate_limit('follower_id', '80', '60');

drop trigger if exists rl_blocks on public.blocks;
create trigger rl_blocks before insert on public.blocks
  for each row execute function public.rate_limit('blocker_id', '30', '60');

drop trigger if exists rl_post_reactions on public.post_reactions;
create trigger rl_post_reactions before insert on public.post_reactions
  for each row execute function public.rate_limit('user_id', '180', '60');

drop trigger if exists rl_post_reposts on public.post_reposts;
create trigger rl_post_reposts before insert on public.post_reposts
  for each row execute function public.rate_limit('user_id', '60', '60');

drop trigger if exists rl_review_reactions on public.review_reactions;
create trigger rl_review_reactions before insert on public.review_reactions
  for each row execute function public.rate_limit('user_id', '180', '60');

drop trigger if exists rl_list_likes on public.list_likes;
create trigger rl_list_likes before insert on public.list_likes
  for each row execute function public.rate_limit('user_id', '120', '60');

drop trigger if exists rl_favorite_books on public.favorite_books;
create trigger rl_favorite_books before insert on public.favorite_books
  for each row execute function public.rate_limit('user_id', '40', '60');

drop trigger if exists rl_profile_genres on public.profile_genres;
create trigger rl_profile_genres before insert on public.profile_genres
  for each row execute function public.rate_limit('user_id', '120', '60');

drop trigger if exists rl_book_genres on public.book_genres;
create trigger rl_book_genres before insert on public.book_genres
  for each row execute function public.rate_limit('created_by', '120', '60');

drop trigger if exists rl_list_items on public.list_items;
create trigger rl_list_items before insert on public.list_items
  for each row execute function public.rate_limit('created_by', '160', '60');

drop trigger if exists rl_notifications on public.notifications;
create trigger rl_notifications before insert on public.notifications
  for each row execute function public.rate_limit('created_by', '120', '60');

drop trigger if exists rl_quotes on public.quotes;
create trigger rl_quotes before insert on public.quotes
  for each row execute function public.rate_limit('user_id', '60', '60');

-- --- 4. Privacy-safe audit log ---------------------------------------
-- This logs mutation metadata, not private bodies/messages/notes. For rejected
-- requests or rate-limit failures, rely on Supabase/Vercel request logs because
-- a DB trigger exception rolls back its own writes.

create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  action     text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  row_id     text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_created_idx
  on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_table_row_created_idx
  on public.audit_logs (table_name, row_id, created_at desc);
create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin" on public.audit_logs for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

create or replace function public.audit_safe_row(input jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(input, '{}'::jsonb)
    - array[
      'body',
      'body_html',
      'body_text',
      'note',
      'bio',
      'description',
      'email',
      'source_title',
      'source_author'
    ];
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  row_data jsonb;
  old_data jsonb;
  rid text;
begin
  if TG_OP = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  if TG_OP = 'UPDATE' then
    old_data := to_jsonb(old);
  end if;

  rid := coalesce(
    row_data->>'id',
    row_data->>'post_id',
    row_data->>'review_id',
    row_data->>'list_id',
    row_data->>'book_id',
    row_data->>'user_id',
    row_data->>'follower_id',
    row_data->>'blocker_id'
  );

  insert into public.audit_logs (actor_id, action, table_name, row_id, metadata)
  values (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    rid,
    jsonb_strip_nulls(jsonb_build_object(
      'row', public.audit_safe_row(row_data),
      'old_row', case when old_data is null then null else public.audit_safe_row(old_data) end
    ))
  );

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

create or replace function public.ensure_audit_trigger(target_table regclass)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  trigger_name text := 'audit_' || replace(target_table::text, '.', '_') || '_trg';
begin
  execute format('drop trigger if exists %I on %s', trigger_name, target_table);
  execute format(
    'create trigger %I after insert or update or delete on %s for each row execute function public.audit_row_change()',
    trigger_name,
    target_table
  );
end $$;

select public.ensure_audit_trigger('public.profiles'::regclass);
select public.ensure_audit_trigger('public.books'::regclass);
select public.ensure_audit_trigger('public.reading_entries'::regclass);
select public.ensure_audit_trigger('public.reviews'::regclass);
select public.ensure_audit_trigger('public.review_reactions'::regclass);
select public.ensure_audit_trigger('public.review_comments'::regclass);
select public.ensure_audit_trigger('public.posts'::regclass);
select public.ensure_audit_trigger('public.post_reactions'::regclass);
select public.ensure_audit_trigger('public.post_comments'::regclass);
select public.ensure_audit_trigger('public.post_reposts'::regclass);
select public.ensure_audit_trigger('public.messages'::regclass);
select public.ensure_audit_trigger('public.notifications'::regclass);
select public.ensure_audit_trigger('public.follows'::regclass);
select public.ensure_audit_trigger('public.blocks'::regclass);
select public.ensure_audit_trigger('public.lists'::regclass);
select public.ensure_audit_trigger('public.list_items'::regclass);
select public.ensure_audit_trigger('public.list_likes'::regclass);
select public.ensure_audit_trigger('public.favorite_books'::regclass);
select public.ensure_audit_trigger('public.profile_genres'::regclass);
select public.ensure_audit_trigger('public.book_genres'::regclass);
select public.ensure_audit_trigger('public.diary_entries'::regclass);
select public.ensure_audit_trigger('public.reading_goals'::regclass);
select public.ensure_audit_trigger('public.reading_sessions'::regclass);
select public.ensure_audit_trigger('public.content_warnings'::regclass);
select public.ensure_audit_trigger('public.quotes'::regclass);

drop function if exists public.ensure_audit_trigger(regclass);
