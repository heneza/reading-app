-- =====================================================================
-- Increment: quarter-star ratings
-- Allow ratings in 0.25 steps (e.g., 4.25) instead of only 0.5.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================
alter table public.reading_entries
  alter column rating type numeric(3, 2);
