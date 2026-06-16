-- =====================================================================
-- Increment: reports + clubs MVP
--   content_reports : user reports for moderation
--   clubs           : public/private reader clubs
--   club_members    : owner/mod/member rows + notification preferences
--   club_posts      : lightweight club discussions and announcements
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'review', 'comment', 'club', 'club_post', 'profile', 'list')),
  target_id   uuid not null,
  reason      text not null default 'other',
  details     text,
  status      text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at  timestamptz not null default now()
);

create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at desc);
create index if not exists content_reports_target_idx
  on public.content_reports (target_type, target_id);

alter table public.content_reports enable row level security;

drop policy if exists "content_reports_insert_own" on public.content_reports;
create policy "content_reports_insert_own" on public.content_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "content_reports_select_own_or_admin" on public.content_reports;
create policy "content_reports_select_own_or_admin" on public.content_reports for select using (
  auth.uid() = reporter_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

drop policy if exists "content_reports_update_admin" on public.content_reports;
create policy "content_reports_update_admin" on public.content_reports for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

create table if not exists public.clubs (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null references public.profiles(id) on delete cascade,
  name                    text not null,
  topic                   text not null,
  description             text,
  image_url               text,
  visibility              text not null default 'public' check (visibility in ('public', 'private')),
  current_book_id         uuid references public.books(id) on delete set null,
  recommendations_list_id uuid references public.lists(id) on delete set null,
  created_at              timestamptz not null default now()
);

create index if not exists clubs_visibility_created_idx on public.clubs (visibility, created_at desc);
create index if not exists clubs_topic_idx on public.clubs (lower(topic));
create index if not exists clubs_owner_idx on public.clubs (owner_id);

create table if not exists public.club_members (
  club_id              uuid not null references public.clubs(id) on delete cascade,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  role                 text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  status               text not null default 'active' check (status in ('active', 'pending', 'blocked')),
  notify_announcements boolean not null default true,
  notify_replies       boolean not null default true,
  notify_current_book  boolean not null default true,
  notify_mentions      boolean not null default true,
  digest_general       boolean not null default false,
  created_at           timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index if not exists club_members_user_idx on public.club_members (user_id, status);
create index if not exists club_members_club_status_idx on public.club_members (club_id, status);

create table if not exists public.club_posts (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  parent_id       uuid references public.club_posts(id) on delete cascade,
  body            text not null,
  is_announcement boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists club_posts_club_created_idx on public.club_posts (club_id, created_at desc);
create index if not exists club_posts_parent_idx on public.club_posts (parent_id, created_at);

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_posts enable row level security;

create or replace function public.is_admin_user(target_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_user and p.is_admin = true
  );
$$;

create or replace function public.is_club_active_member(target_club uuid, target_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select target_user is not null and exists (
    select 1 from public.club_members cm
    where cm.club_id = target_club
      and cm.user_id = target_user
      and cm.status = 'active'
  );
$$;

create or replace function public.can_moderate_club(target_club uuid, target_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select target_user is not null and (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = target_club
        and cm.user_id = target_user
        and cm.status = 'active'
        and cm.role in ('owner', 'moderator')
    )
    or public.is_admin_user(target_user)
  );
$$;

create or replace function public.can_view_club(target_club uuid, target_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.clubs c
    where c.id = target_club
      and (
        c.visibility = 'public'
        or public.is_club_active_member(target_club, target_user)
        or public.is_admin_user(target_user)
      )
  );
$$;

create or replace function public.clubs_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.id := old.id;
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists clubs_guard_trg on public.clubs;
create trigger clubs_guard_trg before update on public.clubs
  for each row execute function public.clubs_guard();

create or replace function public.club_members_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.can_moderate_club(old.club_id, auth.uid()) then
    new.club_id := old.club_id;
    new.user_id := old.user_id;
    new.role := old.role;
    new.status := old.status;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists club_members_guard_trg on public.club_members;
create trigger club_members_guard_trg before update on public.club_members
  for each row execute function public.club_members_guard();

drop policy if exists "clubs_select_visible" on public.clubs;
create policy "clubs_select_visible" on public.clubs for select using (true);

drop policy if exists "clubs_insert_own" on public.clubs;
create policy "clubs_insert_own" on public.clubs for insert
  with check (auth.uid() = owner_id);

drop policy if exists "clubs_update_mod" on public.clubs;
create policy "clubs_update_mod" on public.clubs for update using (
  public.can_moderate_club(id, auth.uid())
) with check (
  public.can_moderate_club(id, auth.uid())
);

drop policy if exists "clubs_delete_owner_admin" on public.clubs;
create policy "clubs_delete_owner_admin" on public.clubs for delete using (
  owner_id = auth.uid() or public.is_admin_user(auth.uid())
);

drop policy if exists "club_members_select_visible" on public.club_members;
create policy "club_members_select_visible" on public.club_members for select using (
  auth.uid() = user_id
  or public.can_moderate_club(club_id, auth.uid())
  or (
    status = 'active'
    and exists (
      select 1 from public.clubs c
      where c.id = club_id
        and (
          c.visibility = 'public'
          or public.is_club_active_member(club_id, auth.uid())
          or public.is_admin_user(auth.uid())
        )
    )
  )
);

drop policy if exists "club_members_insert_self_or_owner" on public.club_members;
create policy "club_members_insert_self_or_owner" on public.club_members for insert with check (
  auth.uid() = user_id
  and (
    (role = 'owner' and status = 'active' and exists (
      select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()
    ))
    or
    (role = 'member' and status = (
      select case when c.visibility = 'public' then 'active' else 'pending' end
      from public.clubs c where c.id = club_id
    ))
  )
);

drop policy if exists "club_members_update_self_prefs_or_mod" on public.club_members;
create policy "club_members_update_self_prefs_or_mod" on public.club_members for update using (
  auth.uid() = user_id or public.can_moderate_club(club_id, auth.uid())
) with check (
  auth.uid() = user_id or public.can_moderate_club(club_id, auth.uid())
);

drop policy if exists "club_members_delete_self_or_mod" on public.club_members;
create policy "club_members_delete_self_or_mod" on public.club_members for delete using (
  auth.uid() = user_id or public.can_moderate_club(club_id, auth.uid())
);

drop policy if exists "club_posts_select_visible" on public.club_posts;
create policy "club_posts_select_visible" on public.club_posts for select using (
  public.can_view_club(club_id, auth.uid())
);

drop policy if exists "club_posts_insert_members" on public.club_posts;
create policy "club_posts_insert_members" on public.club_posts for insert with check (
  auth.uid() = user_id
  and public.is_club_active_member(club_id, auth.uid())
  and (is_announcement = false or public.can_moderate_club(club_id, auth.uid()))
);

drop policy if exists "club_posts_update_author_or_mod" on public.club_posts;
create policy "club_posts_update_author_or_mod" on public.club_posts for update using (
  auth.uid() = user_id or public.can_moderate_club(club_id, auth.uid())
) with check (
  auth.uid() = user_id or public.can_moderate_club(club_id, auth.uid())
);

drop policy if exists "club_posts_delete_author_or_mod" on public.club_posts;
create policy "club_posts_delete_author_or_mod" on public.club_posts for delete using (
  auth.uid() = user_id or public.can_moderate_club(club_id, auth.uid())
);

alter table public.notifications
  add column if not exists club_id uuid references public.clubs(id) on delete cascade,
  add column if not exists club_post_id uuid references public.club_posts(id) on delete cascade;

create index if not exists notifications_club_idx on public.notifications (club_id);
create index if not exists notifications_club_post_idx on public.notifications (club_post_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clubs_name_len') then
    alter table public.clubs
      add constraint clubs_name_len check (char_length(name) between 3 and 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clubs_topic_len') then
    alter table public.clubs
      add constraint clubs_topic_len check (char_length(topic) between 2 and 60) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clubs_desc_len') then
    alter table public.clubs
      add constraint clubs_desc_len check (description is null or char_length(description) <= 600) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'club_posts_body_len') then
    alter table public.club_posts
      add constraint club_posts_body_len check (char_length(body) between 1 and 2000) not valid;
  end if;
end $$;

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
    return new;
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

drop trigger if exists rl_clubs on public.clubs;
create trigger rl_clubs before insert on public.clubs
  for each row execute function public.rate_limit('owner_id', '6', '300');

drop trigger if exists rl_club_posts on public.club_posts;
create trigger rl_club_posts before insert on public.club_posts
  for each row execute function public.rate_limit('user_id', '30', '60');

drop trigger if exists rl_content_reports on public.content_reports;
create trigger rl_content_reports before insert on public.content_reports
  for each row execute function public.rate_limit('reporter_id', '10', '300');
