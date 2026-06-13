-- =====================================================================
-- Increment #4b: like / dislike on reviews
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reaction_type') then
    create type reaction_type as enum ('like', 'dislike');
  end if;
end $$;

create table if not exists public.review_reactions (
  review_id  uuid not null references public.reviews(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       reaction_type not null,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)   -- one reaction per user per review
);

alter table public.review_reactions enable row level security;

drop policy if exists "reactions_select_all" on public.review_reactions;
create policy "reactions_select_all" on public.review_reactions for select using (true);

drop policy if exists "reactions_all_own" on public.review_reactions;
create policy "reactions_all_own" on public.review_reactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
