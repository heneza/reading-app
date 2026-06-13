-- =====================================================================
-- Increment: Direct messages (1:1 inbox between users)
--   messages — one row per message; a "conversation" is all messages
--   between two users. Only the two participants can read a thread.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body         text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists messages_sender_idx    on public.messages (sender_id);
create index if not exists messages_recipient_idx on public.messages (recipient_id);
create index if not exists messages_created_idx   on public.messages (created_at);

alter table public.messages enable row level security;

-- You can only read messages you sent or received.
drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants" on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- You can only send as yourself.
drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages for insert
  with check (auth.uid() = sender_id);

-- Only the recipient can update a message (used to set read_at).
drop policy if exists "messages_update_recipient" on public.messages;
create policy "messages_update_recipient" on public.messages for update
  using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
