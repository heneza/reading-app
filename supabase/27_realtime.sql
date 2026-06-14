-- =====================================================================
-- Increment: enable Supabase Realtime for live messaging + notifications
--   Adds messages, posts, post_reposts to the realtime publication so the
--   client can subscribe to inserts. RLS still applies to subscriptions:
--   - messages: participants only (you only receive your own DMs)
--   - posts / post_reposts: public data; the client further filters to friends
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

-- Full row on updates (so edits / read-receipts carry their data over realtime)
alter table public.messages replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_reposts') then
    alter publication supabase_realtime add table public.post_reposts;
  end if;
end $$;
