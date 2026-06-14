-- =====================================================================
-- Increment: message extras
--   - profiles.read_receipts : whether others may see your "Seen" status
--   - messages.edited_at     : set when a message is edited
--   - senders can edit / delete their own messages
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

alter table public.profiles
  add column if not exists read_receipts boolean not null default true;

alter table public.messages
  add column if not exists edited_at timestamptz;

-- Senders can edit their own messages (recipient-update policy stays for read_at).
drop policy if exists "messages_update_sender" on public.messages;
create policy "messages_update_sender" on public.messages for update
  using (auth.uid() = sender_id) with check (auth.uid() = sender_id);

-- Senders can delete their own messages.
drop policy if exists "messages_delete_sender" on public.messages;
create policy "messages_delete_sender" on public.messages for delete
  using (auth.uid() = sender_id);
