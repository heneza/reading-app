import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { notificationHref, notificationText } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ items: [] }, { status: 401 });

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle(),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const notifications = rows ?? [];
  const actorIds = Array.from(
    new Set(notifications.map((n: any) => n.actor_id).filter(Boolean))
  );
  const actors = new Map<string, any>();

  if (actorIds.length) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', actorIds);
    (data ?? []).forEach((actor: any) => actors.set(actor.id, actor));
  }

  const items = notifications.map((notification: any) => {
    const actor = notification.actor_id ? actors.get(notification.actor_id) : null;
    const context = {
      actorUsername: actor?.username ?? null,
      viewerUsername: profile?.username ?? null,
    };

    return {
      id: notification.id,
      read: notification.read,
      text: notificationText(notification, context),
      href: notificationHref(notification, context),
      createdAt: notification.created_at,
    };
  });

  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : null;

  if (id) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('id', id);
  } else {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .neq('type', 'article_pending');
  }

  return NextResponse.json({ ok: true });
}
