-- =====================================================================
-- Increment: security hardening
--   Moves trust from the app layer into the database, since the public
--   anon key lets any client talk to Postgres directly. Designed to be
--   NON-BREAKING: guard triggers silently keep protected values instead
--   of erroring, so normal flows keep working.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

-- --- 1. profiles: lock privilege + identity columns, enforce username rules
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Only constrain real end-user requests; SQL editor / service role (no
  -- auth.uid()) stay unrestricted so founders can still be set via SQL.
  if auth.uid() is not null then
    new.id := old.id;                                  -- identity immutable
    new.is_admin := old.is_admin;                      -- no self-promotion
    new.username_changed_at := old.username_changed_at;-- client can't spoof

    if new.username is distinct from old.username then
      if new.username !~ '^[A-Za-z0-9_]{3,20}$' then
        raise exception 'Username must be 3-20 letters, numbers or underscores.';
      end if;
      if old.username_changed_at is not null
         and now() - old.username_changed_at < interval '7 days' then
        raise exception 'You can only change your username every 7 days.';
      end if;
      new.username_changed_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg before update on public.profiles
  for each row execute function public.profiles_guard();

-- --- 2. books: ol_key immutable + no overwriting existing data by non-admins
create or replace function public.books_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare admin boolean;
begin
  if auth.uid() is null then
    return new;  -- SQL / service role: unrestricted
  end if;
  select coalesce(p.is_admin, false) into admin from public.profiles p where p.id = auth.uid();

  new.ol_key := old.ol_key;  -- never let a stored key be repointed (SSRF guard)
  if not admin then
    if old.title    is not null then new.title    := old.title;    end if;
    if old.author   is not null then new.author   := old.author;   end if;
    if old.cover_id is not null then new.cover_id := old.cover_id;  end if;
  end if;
  return new;
end $$;

drop trigger if exists books_guard_trg on public.books;
create trigger books_guard_trg before update on public.books
  for each row execute function public.books_guard();

-- --- 3. Length caps at the DB (app caps are bypassable). NOT VALID = only
--        new/updated rows are checked, so existing data never blocks this.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cw_warning_len') then
    alter table public.content_warnings
      add constraint cw_warning_len check (char_length(warning) <= 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lists_title_len') then
    alter table public.lists
      add constraint lists_title_len check (char_length(title) <= 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lists_desc_len') then
    alter table public.lists
      add constraint lists_desc_len check (description is null or char_length(description) <= 600) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'diary_note_len') then
    alter table public.diary_entries
      add constraint diary_note_len check (note is null or char_length(note) <= 280) not valid;
  end if;
end $$;

-- --- 4. avatars bucket: cap size + restrict to images (anti-abuse)
update storage.buckets
  set file_size_limit = 5242880,  -- 5 MB
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  where id = 'avatars';

-- --- 5. blocking: a blocked user can't DM you (and vice-versa)
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;

drop policy if exists "blocks_select_involved" on public.blocks;
create policy "blocks_select_involved" on public.blocks for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);
drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own" on public.blocks for insert
  with check (auth.uid() = blocker_id and blocker_id <> blocked_id);
drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own" on public.blocks for delete
  using (auth.uid() = blocker_id);

-- Re-create the message insert policy to forbid sending when a block exists
-- in either direction.
drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = recipient_id and b.blocked_id = auth.uid())
         or (b.blocker_id = auth.uid()   and b.blocked_id = recipient_id)
    )
  );
