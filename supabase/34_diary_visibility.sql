-- =====================================================================
-- Increment: diary visibility
--   profiles.diary_visibility controls who can read diary entries:
--   public, friends, or private. Friends means mutual follows.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

alter table public.profiles
  add column if not exists diary_visibility text not null default 'public'
    check (diary_visibility in ('public', 'friends', 'private'));

drop policy if exists "diary_select_all" on public.diary_entries;
drop policy if exists "diary_select_visible" on public.diary_entries;
create policy "diary_select_visible" on public.diary_entries for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = diary_entries.user_id
      and p.diary_visibility = 'public'
  )
  or (
    auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = diary_entries.user_id
        and p.diary_visibility = 'friends'
    )
    and exists (
      select 1
      from public.follows f
      where f.follower_id = auth.uid()
        and f.followee_id = diary_entries.user_id
    )
    and exists (
      select 1
      from public.follows f
      where f.follower_id = diary_entries.user_id
        and f.followee_id = auth.uid()
    )
  )
);
