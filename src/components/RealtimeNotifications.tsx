'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

type Friend = { id: string; username: string };
type Toast = { id: string; text: string; href: string };

export default function RealtimeNotifications({
  meId,
}: {
  meId: string;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();
  const friendMap = useRef(new Map<string, string>());

  function push(text: string, href: string) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t.slice(-2), { id, text, href }]); // keep at most 3
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;

    async function loadFriends(): Promise<Friend[]> {
      const [{ data: outRows }, { data: inRows }] = await Promise.all([
        supabase.from('follows').select('followee_id').eq('follower_id', meId),
        supabase.from('follows').select('follower_id').eq('followee_id', meId),
      ]);
      const out = new Set((outRows ?? []).map((row: any) => row.followee_id));
      const friendIds = (inRows ?? [])
        .map((row: any) => row.follower_id)
        .filter((id: string) => out.has(id));

      if (friendIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', friendIds);

      return (profiles ?? []).map((profile: any) => ({
        id: profile.id,
        username: profile.username,
      }));
    }

    loadFriends().then((loadedFriends) => {
      if (!active) return;
      friendMap.current = new Map(loadedFriends.map((friend) => [friend.id, friend.username]));
      const friendIds = loadedFriends.map((friend) => friend.id);
      channel = supabase.channel('notify');

      // Incoming direct messages (RLS guarantees these are addressed to me).
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${meId}` },
        async (payload: any) => {
          const senderId = payload.new?.sender_id;
          if (!senderId || senderId === meId) return;
          let uname = friendMap.current.get(senderId);
          if (!uname) {
            const { data } = await supabase.from('profiles').select('username').eq('id', senderId).maybeSingle();
            uname = data?.username ?? undefined;
          }
          if (!uname) return;
          // Don't toast if I'm already looking at that conversation.
          if (typeof window !== 'undefined' && window.location.pathname === `/messages/${uname}`) return;
          push(`New message from @${uname}`, `/messages/${uname}`);
        }
      );

      // Friends' new posts + reposts (only subscribe if I have friends).
      if (friendIds.length) {
        const inList = `(${friendIds.join(',')})`;
        channel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'posts', filter: `user_id=in.${inList}` },
          (payload: any) => {
            if (payload.new?.status !== 'published') return;
            const uname = friendMap.current.get(payload.new.user_id);
            if (!uname) return;
            push(`@${uname} posted`, `/u/${uname}`);
          }
        );
        channel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'post_reposts', filter: `user_id=in.${inList}` },
          (payload: any) => {
            const uname = friendMap.current.get(payload.new?.user_id);
            if (!uname) return;
            push(`@${uname} reposted`, `/u/${uname}`);
          }
        );
      }

      channel.subscribe();
    }).catch(() => {
      /* Realtime notifications are best-effort; page rendering should continue. */
    });

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-5 top-20 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            router.push(t.href);
            setToasts((arr) => arr.filter((x) => x.id !== t.id));
          }}
          className="animate-in flex w-64 items-center gap-2 rounded-xl border border-stone-200 bg-white/95 px-4 py-3 text-left text-sm text-stone-700 shadow-card backdrop-blur transition hover:border-brand/50"
        >
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand" />
          <span className="min-w-0 flex-1 truncate">{t.text}</span>
        </button>
      ))}
    </div>
  );
}
