-- =====================================================================
-- Increment #2: public profiles
-- Make reading entries (shelves) viewable by everyone, so profile pages
-- can show other people's books. Writes stay restricted to the owner
-- (handled by the existing "entries_all_own" policy).
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

drop policy if exists "entries_select_own"    on public.reading_entries;
drop policy if exists "entries_select_public" on public.reading_entries;

create policy "entries_select_public"
  on public.reading_entries for select using (true);
