import { createClient } from '@/utils/supabase/server';
import PostCard from '@/components/PostCard';

export const dynamic = 'force-dynamic';

export default async function ArticlesPage() {
  const supabase = createClient();
  const { data: articlesData } = await supabase
    .from('posts')
    .select('*')
    .eq('is_article', true)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(40);
  const articles = articlesData ?? [];

  const authors = new Map<string, any>();
  const ids = Array.from(new Set(articles.map((p: any) => p.user_id)));
  if (ids.length) {
    const { data: au } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', ids);
    (au ?? []).forEach((a: any) => authors.set(a.id, a));
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Articles</h1>
      <p className="mb-6 text-sm text-stone-500">Long-form writing from the community.</p>
      {articles.length === 0 ? (
        <p className="text-stone-500">No articles published yet.</p>
      ) : (
        <ul className="space-y-4">
          {articles.map((p: any) => (
            <li key={p.id}>
              <PostCard post={p} author={authors.get(p.user_id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
