-- =====================================================================
-- Increment: collect date of birth + gender at sign-up.
--   - profiles.date_of_birth, profiles.gender
--   - signup trigger reads them from user metadata
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists gender text;

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

  insert into public.profiles (id, username, display_name, date_of_birth, gender)
  values (
    new.id,
    uname,
    uname,
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    nullif(new.raw_user_meta_data->>'gender', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
