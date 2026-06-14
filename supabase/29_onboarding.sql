-- =====================================================================
-- Increment: onboarding flag so OAuth (Google) users follow the same
--   /welcome flow as email sign-ups (pick username, display name, genres).
--   New accounts start un-onboarded; existing accounts are grandfathered in.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- Everyone who already exists has effectively onboarded — don't send them
-- back through the welcome flow.
update public.profiles set onboarded = true where onboarded = false;
