-- =====================================================================
-- Increment #1b: allow multiple reviews per user per book
-- Removes the unique(user_id, book_id) constraint added in 02_reviews.sql
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

do $$
declare
  c text;
begin
  -- find the unique constraint on public.reviews (whatever its name) and drop it
  select conname into c
    from pg_constraint
   where conrelid = 'public.reviews'::regclass
     and contype = 'u';
  if c is not null then
    execute format('alter table public.reviews drop constraint %I', c);
  end if;
end $$;
