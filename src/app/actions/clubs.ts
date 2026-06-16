'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

type Membership = {
  role: 'owner' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'blocked';
};

function cleanText(value: FormDataEntryValue | null, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function cleanUrl(value: FormDataEntryValue | null) {
  const raw = cleanText(value, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function clubPath(clubId: string) {
  return `/clubs/${clubId}`;
}

async function requireUser(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function getMembership(supabase: any, clubId: string, userId: string): Promise<Membership | null> {
  const { data } = await supabase
    .from('club_members')
    .select('role, status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

async function canModerate(supabase: any, clubId: string, userId: string) {
  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from('club_members')
      .select('role, status')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('profiles').select('is_admin').eq('id', userId).maybeSingle(),
  ]);
  return (
    !!profile?.is_admin ||
    (membership?.status === 'active' && ['owner', 'moderator'].includes(membership.role))
  );
}

async function activeMemberIdsWithPref(supabase: any, clubId: string, pref: string) {
  const { data } = await supabase
    .from('club_members')
    .select(`user_id, ${pref}`)
    .eq('club_id', clubId)
    .eq('status', 'active');
  return (data ?? []).filter((row: any) => row[pref] !== false).map((row: any) => row.user_id as string);
}

async function notifyUsers(
  supabase: any,
  userIds: string[],
  input: {
    type: string;
    actorId: string;
    clubId: string;
    clubPostId?: string | null;
  }
) {
  const rows = Array.from(new Set(userIds))
    .filter((id) => id !== input.actorId)
    .map((id) => ({
      user_id: id,
      type: input.type,
      actor_id: input.actorId,
      club_id: input.clubId,
      club_post_id: input.clubPostId ?? null,
    }));
  if (rows.length) await supabase.from('notifications').insert(rows);
}

async function notifyMentions(supabase: any, clubId: string, postId: string, actorId: string, body: string) {
  const names = Array.from(body.matchAll(/@([A-Za-z0-9_]{3,20})/g)).map((match) =>
    match[1].toLowerCase()
  );
  const uniqueNames = Array.from(new Set(names));
  if (uniqueNames.length === 0) return;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('username', uniqueNames);
  const mentionedIds = (profiles ?? []).map((profile: any) => profile.id as string);
  if (mentionedIds.length === 0) return;

  const allowedIds = await activeMemberIdsWithPref(supabase, clubId, 'notify_mentions');
  await notifyUsers(
    supabase,
    mentionedIds.filter((id: string) => allowedIds.includes(id)),
    { type: 'club_mention', actorId, clubId, clubPostId: postId }
  );
}

export async function createClub(formData: FormData) {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) redirect('/login?next=/clubs');

  const name = cleanText(formData.get('name'), 80);
  const topic = cleanText(formData.get('topic'), 60);
  const description = cleanText(formData.get('description'), 600) || null;
  const visibility = cleanText(formData.get('visibility'), 20) === 'private' ? 'private' : 'public';
  const imageUrl = cleanUrl(formData.get('imageUrl'));
  if (name.length < 3 || topic.length < 2) redirect('/clubs');

  const { data: club } = await supabase
    .from('clubs')
    .insert({
      owner_id: user.id,
      name,
      topic,
      description,
      visibility,
      image_url: imageUrl,
    })
    .select('id')
    .single();

  if (club?.id) {
    await supabase.from('club_members').insert({
      club_id: club.id,
      user_id: user.id,
      role: 'owner',
      status: 'active',
    });
    revalidatePath('/');
    revalidatePath('/clubs');
    redirect(clubPath(club.id));
  }
  redirect('/clubs');
}

export async function joinClub(formData: FormData) {
  const supabase = createClient();
  const user = await requireUser(supabase);
  const clubId = cleanText(formData.get('clubId'), 80);
  if (!user) redirect(`/login?next=${encodeURIComponent(clubPath(clubId))}`);

  const { data: club } = await supabase
    .from('clubs')
    .select('id, visibility')
    .eq('id', clubId)
    .maybeSingle();
  if (!club) return;

  await supabase.from('club_members').upsert(
    {
      club_id: clubId,
      user_id: user.id,
      role: 'member',
      status: club.visibility === 'public' ? 'active' : 'pending',
    },
    { onConflict: 'club_id,user_id' }
  );

  revalidatePath('/clubs');
  revalidatePath(clubPath(clubId));
}

export async function leaveClub(formData: FormData) {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return;
  const clubId = cleanText(formData.get('clubId'), 80);
  const membership = await getMembership(supabase, clubId, user.id);
  if (membership?.role === 'owner') return;

  await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', user.id);
  revalidatePath('/clubs');
  revalidatePath(clubPath(clubId));
}

export async function createClubPost(formData: FormData) {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return;
  const clubId = cleanText(formData.get('clubId'), 80);
  const parentId = cleanText(formData.get('parentId'), 80) || null;
  const body = cleanText(formData.get('body'), 2000);
  if (!clubId || !body) return;

  const membership = await getMembership(supabase, clubId, user.id);
  if (membership?.status !== 'active') return;

  const requestedAnnouncement = formData.get('isAnnouncement') === 'on';
  const isAnnouncement = requestedAnnouncement && (await canModerate(supabase, clubId, user.id));

  const { data: post } = await supabase
    .from('club_posts')
    .insert({
      club_id: clubId,
      user_id: user.id,
      parent_id: parentId,
      body,
      is_announcement: isAnnouncement,
    })
    .select('id')
    .single();
  if (!post?.id) return;

  if (isAnnouncement) {
    const ids = await activeMemberIdsWithPref(supabase, clubId, 'notify_announcements');
    await notifyUsers(supabase, ids, {
      type: 'club_announcement',
      actorId: user.id,
      clubId,
      clubPostId: post.id,
    });
  }

  if (parentId) {
    const { data: parent } = await supabase
      .from('club_posts')
      .select('user_id')
      .eq('id', parentId)
      .maybeSingle();
    const ids = await activeMemberIdsWithPref(supabase, clubId, 'notify_replies');
    if (parent?.user_id && ids.includes(parent.user_id)) {
      await notifyUsers(supabase, [parent.user_id], {
        type: 'club_reply',
        actorId: user.id,
        clubId,
        clubPostId: post.id,
      });
    }
  }

  await notifyMentions(supabase, clubId, post.id, user.id, body);
  revalidatePath(clubPath(clubId));
}

export async function deleteClubPost(formData: FormData) {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return;
  const clubId = cleanText(formData.get('clubId'), 80);
  const postId = cleanText(formData.get('postId'), 80);
  if (!clubId || !postId) return;

  await supabase.from('club_posts').delete().eq('id', postId).eq('club_id', clubId);
  revalidatePath(clubPath(clubId));
}

export async function updateClubSettings(formData: FormData) {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return;
  const clubId = cleanText(formData.get('clubId'), 80);
  if (!(await canModerate(supabase, clubId, user.id))) return;

  const { data: current } = await supabase
    .from('clubs')
    .select('current_book_id')
    .eq('id', clubId)
    .maybeSingle();

  const currentBookId = cleanText(formData.get('currentBookId'), 80) || null;
  const recommendationsListId = cleanText(formData.get('recommendationsListId'), 80) || null;
  const visibility = cleanText(formData.get('visibility'), 20) === 'private' ? 'private' : 'public';

  await supabase
    .from('clubs')
    .update({
      name: cleanText(formData.get('name'), 80),
      topic: cleanText(formData.get('topic'), 60),
      description: cleanText(formData.get('description'), 600) || null,
      image_url: cleanUrl(formData.get('imageUrl')),
      visibility,
      current_book_id: currentBookId,
      recommendations_list_id: recommendationsListId,
    })
    .eq('id', clubId);

  if (currentBookId && current?.current_book_id !== currentBookId) {
    const ids = await activeMemberIdsWithPref(supabase, clubId, 'notify_current_book');
    await notifyUsers(supabase, ids, {
      type: 'club_current_book',
      actorId: user.id,
      clubId,
      clubPostId: null,
    });
  }

  revalidatePath('/clubs');
  revalidatePath(clubPath(clubId));
}

export async function updateClubNotificationPrefs(formData: FormData) {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return;
  const clubId = cleanText(formData.get('clubId'), 80);

  await supabase
    .from('club_members')
    .update({
      notify_announcements: formData.get('notifyAnnouncements') === 'on',
      notify_replies: formData.get('notifyReplies') === 'on',
      notify_current_book: formData.get('notifyCurrentBook') === 'on',
      notify_mentions: formData.get('notifyMentions') === 'on',
      digest_general: formData.get('digestGeneral') === 'on',
    })
    .eq('club_id', clubId)
    .eq('user_id', user.id);

  revalidatePath(clubPath(clubId));
}

export async function moderateClubMember(formData: FormData) {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return;
  const clubId = cleanText(formData.get('clubId'), 80);
  const memberId = cleanText(formData.get('memberId'), 80);
  const action = cleanText(formData.get('action'), 20);
  if (!(await canModerate(supabase, clubId, user.id))) return;

  if (action === 'approve') {
    await supabase
      .from('club_members')
      .update({ status: 'active', role: 'member' })
      .eq('club_id', clubId)
      .eq('user_id', memberId);
  } else if (action === 'remove') {
    await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', memberId)
      .neq('role', 'owner');
  } else if (action === 'mod') {
    await supabase
      .from('club_members')
      .update({ role: 'moderator', status: 'active' })
      .eq('club_id', clubId)
      .eq('user_id', memberId)
      .neq('role', 'owner');
  } else if (action === 'member') {
    await supabase
      .from('club_members')
      .update({ role: 'member' })
      .eq('club_id', clubId)
      .eq('user_id', memberId)
      .neq('role', 'owner');
  }

  revalidatePath(clubPath(clubId));
}
