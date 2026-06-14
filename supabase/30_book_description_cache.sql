-- =====================================================================
-- Increment: cache book descriptions so the book page doesn't hit Open
--   Library on every view (it was adding ~seconds per page load).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

alter table public.books
  add column if not exists description text;
