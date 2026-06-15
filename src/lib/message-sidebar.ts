export type MessageSidebarItem = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  relation: 'friend' | 'following' | 'conversation';
  lastBody: string | null;
  lastAt: string | null;
  lastMine: boolean;
  lastReadAt: string | null;
  showSeen: boolean;
  unread: number;
  hasMessages: boolean;
};

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type Conversation = {
  otherId: string;
  last: MessageRow;
  unread: number;
};

export async function loadMessageSidebarItems(
  supabase: any,
  userId: string,
  extraUserIds: string[] = []
): Promise<MessageSidebarItem[]> {
  const [messageRes, followingRes] = await Promise.all([
    supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, created_at, read_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const byOther = new Map<string, Conversation>();
  for (const message of (messageRes.data ?? []) as MessageRow[]) {
    const otherId = message.sender_id === userId ? message.recipient_id : message.sender_id;
    const existing = byOther.get(otherId);
    const isUnread = message.recipient_id === userId && !message.read_at;

    if (!existing) {
      byOther.set(otherId, {
        otherId,
        last: message,
        unread: isUnread ? 1 : 0,
      });
    } else if (isUnread) {
      existing.unread += 1;
    }
  }

  const followingIds = ((followingRes.data ?? []) as { followee_id: string }[]).map(
    (row) => row.followee_id
  );
  const followingSet = new Set(followingIds);
  const friendSet = new Set<string>();

  if (followingIds.length) {
    const { data: mutualRows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('followee_id', userId)
      .in('follower_id', followingIds);

    for (const row of (mutualRows ?? []) as { follower_id: string }[]) {
      friendSet.add(row.follower_id);
    }
  }

  const candidateIds = new Set<string>(followingIds);
  for (const id of extraUserIds) {
    if (id !== userId) candidateIds.add(id);
  }
  for (const otherId of Array.from(byOther.keys())) {
    candidateIds.add(otherId);
  }

  if (candidateIds.size === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, read_receipts')
    .in('id', Array.from(candidateIds));

  const items = ((profiles ?? []) as any[])
    .filter((profile) => profile.username)
    .map((profile): MessageSidebarItem => {
      const convo = byOther.get(profile.id);
      const isFollowing = followingSet.has(profile.id);
      const relation = friendSet.has(profile.id)
        ? 'friend'
        : isFollowing
          ? 'following'
          : 'conversation';

      return {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        relation,
        lastBody: convo?.last.body ?? null,
        lastAt: convo?.last.created_at ?? null,
        lastMine: convo ? convo.last.sender_id === userId : false,
        lastReadAt: convo?.last.read_at ?? null,
        showSeen: profile.read_receipts !== false,
        unread: convo?.unread ?? 0,
        hasMessages: !!convo,
      };
    });

  const relationRank: Record<MessageSidebarItem['relation'], number> = {
    friend: 0,
    following: 1,
    conversation: 2,
  };

  return items.sort((a, b) => {
    if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
    if (a.hasMessages !== b.hasMessages) return a.hasMessages ? -1 : 1;
    if (a.lastAt || b.lastAt) {
      if (!a.lastAt) return 1;
      if (!b.lastAt) return -1;
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    }
    if (a.relation !== b.relation) return relationRank[a.relation] - relationRank[b.relation];
    const aName = a.displayName ?? a.username;
    const bName = b.displayName ?? b.username;
    return aName.localeCompare(bName);
  });
}
