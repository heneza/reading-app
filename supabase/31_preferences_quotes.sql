-- =====================================================================
-- Increment: user preferences + quotes
--   - Email notification preferences live on profiles.
--   - spotify_url is a lightweight profile link until OAuth is chosen.
--   - quotes is a private saved/written quotes workspace.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

alter table public.profiles
  add column if not exists email_notifications boolean not null default true,
  add column if not exists email_notification_frequency text not null default 'immediate',
  add column if not exists email_article_updates boolean not null default true,
  add column if not exists spotify_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_email_frequency_check'
  ) then
    alter table public.profiles
      add constraint profiles_email_frequency_check
      check (email_notification_frequency in ('immediate', 'daily', 'weekly', 'off'))
      not valid;
  end if;
end $$;

create table if not exists public.quotes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 1000),
  source_title  text,
  source_author text,
  note          text,
  tags          text[] not null default '{}',
  visibility    text not null default 'private' check (visibility in ('private', 'public')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists quotes_user_created_idx on public.quotes (user_id, created_at desc);
create index if not exists quotes_tags_idx on public.quotes using gin (tags);

alter table public.quotes enable row level security;

drop policy if exists "quotes_select_visible" on public.quotes;
create policy "quotes_select_visible" on public.quotes for select using (
  user_id = auth.uid() or visibility = 'public'
);

drop policy if exists "quotes_insert_own" on public.quotes;
create policy "quotes_insert_own" on public.quotes for insert
  to authenticated with check (user_id = auth.uid());

drop policy if exists "quotes_update_own" on public.quotes;
create policy "quotes_update_own" on public.quotes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "quotes_delete_own" on public.quotes;
create policy "quotes_delete_own" on public.quotes for delete
  using (user_id = auth.uid());
