-- =====================================================================
-- Increment: per-user write rate limiting (anti-spam / anti-abuse)
--   A generic trigger that rejects more than N inserts per user within
--   a time window on a given table. SQL editor / service role (no
--   auth.uid()) are never limited. Limits are generous — they only
--   stop scripts/spam, not normal use.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

create or replace function public.rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_col text := TG_ARGV[0];
  max_rows int  := TG_ARGV[1]::int;
  win_sec  int  := TG_ARGV[2]::int;
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    return new;  -- service role / SQL editor: unrestricted
  end if;
  execute format(
    'select count(*) from public.%I where %I = $1 and created_at > now() - make_interval(secs => $2)',
    TG_TABLE_NAME, user_col
  ) into n using uid, win_sec;
  if n >= max_rows then
    raise exception 'Rate limit exceeded — please slow down and try again in a moment.'
      using errcode = '53400';
  end if;
  return new;
end $$;

-- Apply to the user-writable tables (col, max-per-window, window-seconds).
drop trigger if exists rl_messages on public.messages;
create trigger rl_messages before insert on public.messages
  for each row execute function public.rate_limit('sender_id', '30', '60');

drop trigger if exists rl_posts on public.posts;
create trigger rl_posts before insert on public.posts
  for each row execute function public.rate_limit('user_id', '12', '60');

drop trigger if exists rl_lists on public.lists;
create trigger rl_lists before insert on public.lists
  for each row execute function public.rate_limit('owner_id', '10', '60');

drop trigger if exists rl_content_warnings on public.content_warnings;
create trigger rl_content_warnings before insert on public.content_warnings
  for each row execute function public.rate_limit('user_id', '20', '60');

drop trigger if exists rl_reviews on public.reviews;
create trigger rl_reviews before insert on public.reviews
  for each row execute function public.rate_limit('user_id', '12', '60');

drop trigger if exists rl_review_comments on public.review_comments;
create trigger rl_review_comments before insert on public.review_comments
  for each row execute function public.rate_limit('user_id', '40', '60');

drop trigger if exists rl_post_comments on public.post_comments;
create trigger rl_post_comments before insert on public.post_comments
  for each row execute function public.rate_limit('user_id', '40', '60');

drop trigger if exists rl_diary_entries on public.diary_entries;
create trigger rl_diary_entries before insert on public.diary_entries
  for each row execute function public.rate_limit('user_id', '40', '60');

drop trigger if exists rl_reading_sessions on public.reading_sessions;
create trigger rl_reading_sessions before insert on public.reading_sessions
  for each row execute function public.rate_limit('user_id', '40', '60');
