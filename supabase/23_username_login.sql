-- =====================================================================
-- Increment: allow logging in with EITHER email or username.
--   Supabase Auth signs in by email, so we resolve a username to its
--   email server-side via a SECURITY DEFINER function (it can read
--   auth.users, which clients cannot).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

create or replace function public.email_for_username(uname text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(uname)
  limit 1;
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;
