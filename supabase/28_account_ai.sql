-- =====================================================================
-- Increment: AI off-switch + GDPR account deletion
--   - profiles.ai_enabled : per-user toggle to fully disable the assistant
--   - delete_user()       : lets a user delete their own account. Deleting
--                           the auth.users row cascades to profiles and all
--                           their data (every table cascades from there).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

alter table public.profiles
  add column if not exists ai_enabled boolean not null default true;

create or replace function public.delete_user()
returns void
language plpgsql
security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  -- Cascades: profiles + reading entries, reviews, posts, diary, lists,
  -- messages, goals, blocks, etc. all delete via ON DELETE CASCADE.
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_user() from public;
grant execute on function public.delete_user() to authenticated;
