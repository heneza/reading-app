-- =====================================================================
-- Increment #4a: profile bio + social links
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

alter table public.profiles
  add column if not exists website   text,
  add column if not exists twitter   text,
  add column if not exists instagram text;
