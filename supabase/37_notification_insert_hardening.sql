-- =====================================================================
-- Increment: notification insert hardening (#3 — anti-spoofing / anti-spam)
--   Before: `notifications_insert_auth` allowed any authenticated user to
--   insert a notification for ANY user_id with ANY actor_id and type, so an
--   attacker could forge notifications that appear to come from someone else
--   (impersonation) or flood a victim's inbox.
--
--   After: a client may only insert notifications where it is the actor
--   (actor_id = auth.uid()). All legitimate app paths already do this
--   (article review, club events). The internal notify_* triggers are
--   SECURITY DEFINER and bypass RLS, so system notifications keep working.
--   A generous per-actor rate limit caps inbox flooding.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run. Idempotent.
-- =====================================================================

drop policy if exists "notifications_insert_auth" on public.notifications;
create policy "notifications_insert_auth" on public.notifications for insert
  to authenticated with check (actor_id = auth.uid());

-- Cap how many notifications one actor can generate per minute (spam guard).
-- Re-uses the generic rate_limit() trigger from migration 24. The notify_*
-- triggers fire during the acting user's transaction, so this also bounds
-- fan-out, but the limit is high enough not to affect normal use. Inserts
-- with no auth.uid() (e.g. the signup trigger) are never limited.
drop trigger if exists rl_notifications on public.notifications;
create trigger rl_notifications before insert on public.notifications
  for each row execute function public.rate_limit('actor_id', '60', '60');
