import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // RLS scopes each of these to the requesting user (messages includes the
  // ones they sent or received — all genuinely their data).
  const [
    profile, entries, reviews, comments, posts, diary, goals, sessions,
    lists, listItems, quotes, contentWarnings, messages, blocks,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('reading_entries').select('*').eq('user_id', user.id),
    supabase.from('reviews').select('*').eq('user_id', user.id),
    supabase.from('review_comments').select('*').eq('user_id', user.id),
    supabase.from('posts').select('*').eq('user_id', user.id),
    supabase.from('diary_entries').select('*').eq('user_id', user.id),
    supabase.from('reading_goals').select('*').eq('user_id', user.id),
    supabase.from('reading_sessions').select('*').eq('user_id', user.id),
    supabase.from('lists').select('*').eq('owner_id', user.id),
    supabase.from('list_likes').select('*').eq('user_id', user.id),
    supabase.from('quotes').select('*').eq('user_id', user.id),
    supabase.from('content_warnings').select('*').eq('user_id', user.id),
    supabase.from('messages').select('*').or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`),
    supabase.from('blocks').select('*').eq('blocker_id', user.id),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile: profile.data ?? null,
    reading_entries: entries.data ?? [],
    reviews: reviews.data ?? [],
    review_comments: comments.data ?? [],
    posts: posts.data ?? [],
    diary_entries: diary.data ?? [],
    reading_goals: goals.data ?? [],
    reading_sessions: sessions.data ?? [],
    lists: lists.data ?? [],
    list_likes: listItems.data ?? [],
    quotes: quotes.data ?? [],
    content_warnings: contentWarnings.data ?? [],
    messages: messages.data ?? [],
    blocks: blocks.data ?? [],
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="reading-app-export.json"',
    },
  });
}
