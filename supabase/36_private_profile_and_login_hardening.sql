-- =====================================================================
-- Increment: security hardening
--   #1  Stop the public anon key from harvesting emails: email_for_username
--       reads auth.users, so it must NOT be callable by browser clients.
--       It is now resolved server-side with the service-role key only.
--   #2  date_of_birth + gender were world-readable: the profiles SELECT
--       policy is `using (true)` and RLS is column-blind, so every column
--       (including these) was dumpable with the public anon key. Move them
--       to an owner-only `private_profiles` table and drop them from the
--       public table.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- NOTE: existing DOB/gender values are MIGRATED into private_profiles
--       before the public columns are dropped (no data loss).
-- =====================================================================

-- --- #1: lock down email_for_username -------------------------------
-- PUBLIC was already revoked in migration 23; remove the anon/authenticated
-- grants too. Only the service role (server-side, never shipped to the
-- browser) may resolve a username to its account email.
revoke execute on function public.email_for_username(text) from anon, authenticated;
grant  execute on function public.email_for_username(text) to   service_role;

-- --- #2: move sensitive identity fields off the public profiles table ----
create table if not exists public.private_profiles (
  id            uuid primary key references public.profiles(id) on delete cascade,
  date_of_birth date,
  gender        text,
  created_at    timestamptz not null default now()
);

alter table public.private_profiles enable row level security;

-- Only the owner may read or write their own private profile row.
drop policy if exists "private_profiles_select_own" on public.private_profiles;
create policy "private_profiles_select_own" on public.private_profiles for select
  using (auth.uid() = id);

drop policy if exists "private_profiles_insert_own" on public.private_profiles;
create policy "private_profiles_insert_own" on public.private_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "private_profiles_update_own" on public.private_profiles;
create policy "private_profiles_update_own" on public.private_profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Migrate any existing values out of the public table (only while the old
-- columns still exist, so re-running this script is a no-op).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'date_of_birth'
  ) then
    insert into public.private_profiles (id, date_of_birth, gender)
    select id, date_of_birth, gender
    from public.profiles
    where date_of_birth is not null or gender is not null
    on conflict (id) do update
      set date_of_birth = coalesce(public.private_profiles.date_of_birth, excluded.date_of_birth),
          gender        = coalesce(public.private_profiles.gender,        excluded.gender);
  end if;
end $$;

-- The signup trigger now writes the sensitive fields to the private table.
-- (Username/display_name still go to the public profile as before.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  uname text;
begin
  uname := nullif(trim(new.raw_user_meta_data->>'username'), '');
  if uname is null then
    uname := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, uname, uname)
  on conflict (id) do nothing;

  insert into public.private_profiles (id, date_of_birth, gender)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    nullif(new.raw_user_meta_data->>'gender', '')
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- Finally, remove the now-migrated sensitive columns from the public table
-- so they can no longer leak through the `using (true)` SELECT policy.
alter table public.profiles drop column if exists date_of_birth;
alter table public.profiles drop column if exists gender;
