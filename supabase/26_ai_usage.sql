-- =====================================================================
-- Increment: AI assistant usage metering (cost control + abuse limits)
--   ai_usage : one row per assistant request, used to enforce a daily
--              cap and a per-minute rate limit. We store ONLY a timestamp
--              and the user id — never the message content (data minimisation).
-- Requires migration 24 (the rate_limit() function).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own" on public.ai_usage for insert with check (auth.uid() = user_id);
drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage for select using (auth.uid() = user_id);

-- Burst limit: max 15 assistant calls per minute per user.
drop trigger if exists rl_ai_usage on public.ai_usage;
create trigger rl_ai_usage before insert on public.ai_usage
  for each row execute function public.rate_limit('user_id', '15', '60');
