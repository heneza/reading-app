-- =====================================================================
-- Increment: chosen usernames (with cooldown) + avatar uploads
--   - profiles.username_changed_at : when the username was last changed
--   - profiles.avatar_url          : public URL of the user's photo
--   - signup trigger now uses the username the user picked
--   - an "avatars" Storage bucket + policies for profile photos
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

alter table public.profiles
  add column if not exists username_changed_at timestamptz,
  add column if not exists avatar_url           text;

-- Use the username chosen at signup (passed in user metadata), falling
-- back to the email's local part if none was provided.
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
  return new;
end;
$$;

-- --- Storage: avatars bucket -----------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone can view avatars (public bucket).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- A signed-in user can only write inside their own folder: "<user-id>/..."
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
