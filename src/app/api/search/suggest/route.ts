import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
};

type Suggestion = {
  type: 'book' | 'author' | 'user' | 'post';
  title: string;
  subtitle?: string;
  href: string;
};

const FILTERS = new Set(['all', 'books', 'authors', 'users', 'posts']);

function cleanQuery(raw: string | null) {
  return (raw ?? '').trim().replace(/[%,()"\\]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
}

function ilike(q: string) {
  return `%${q}%`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = cleanQuery(url.searchParams.get('q'));
  const filterParam = url.searchParams.get('filter') ?? 'all';
  const filter = FILTERS.has(filterParam) ? filterParam : 'all';

  if (q.length < 2) return NextResponse.json({ items: [] }, { headers: CACHE_HEADERS });
  const tasks: PromiseLike<Suggestion[]>[] = [];

  if (filter === 'all' || filter === 'books') {
    tasks.push(
      supabase
        .from('books')
        .select('id, title, author')
        .ilike('title', ilike(q))
        .limit(filter === 'books' ? 10 : 5)
        .then(({ data }) =>
          (data ?? []).map((b: any) => ({
            type: 'book' as const,
            title: b.title,
            subtitle: b.author ? `Book by ${b.author}` : 'Book',
            href: `/book/${b.id}`,
          }))
        )
    );
  }

  if (filter === 'all' || filter === 'authors') {
    tasks.push(
      supabase
        .from('books')
        .select('author')
        .ilike('author', ilike(q))
        .not('author', 'is', null)
        .limit(filter === 'authors' ? 20 : 8)
        .then(({ data }) => {
          const seen = new Set<string>();
          return (data ?? [])
            .map((b: any) => String(b.author ?? '').trim())
            .filter((author) => {
              const key = author.toLowerCase();
              if (!author || seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .slice(0, filter === 'authors' ? 10 : 3)
            .map((author) => ({
              type: 'author' as const,
              title: author,
              subtitle: 'Author',
              href: `/search?filter=books&q=${encodeURIComponent(author)}`,
            }));
        })
    );
  }

  if (filter === 'all' || filter === 'users') {
    tasks.push(
      supabase
        .from('profiles')
        .select('username, display_name')
        .or(`username.ilike.${ilike(q)},display_name.ilike.${ilike(q)}`)
        .limit(filter === 'users' ? 10 : 4)
        .then(({ data }) =>
          (data ?? []).map((u: any) => ({
            type: 'user' as const,
            title: u.display_name ?? `@${u.username}`,
            subtitle: `@${u.username}`,
            href: `/u/${u.username}`,
          }))
        )
    );
  }

  if (filter === 'all' || filter === 'posts') {
    const tag = q.toLowerCase().replace(/^#/, '').replace(/[^a-z0-9._-]/g, '');
    tasks.push(
      Promise.all([
        supabase
          .from('posts')
          .select('id, body_text, tags')
          .eq('status', 'published')
          .ilike('body_text', ilike(q))
          .limit(filter === 'posts' ? 10 : 4),
        tag
          ? supabase
              .from('posts')
              .select('id, body_text, tags')
              .eq('status', 'published')
              .contains('tags', [tag])
              .limit(filter === 'posts' ? 10 : 4)
          : Promise.resolve({ data: [] as any[] }),
      ]).then(([textRes, tagRes]) => {
        const seen = new Map<string, any>();
        [...(tagRes.data ?? []), ...(textRes.data ?? [])].forEach((p: any) => seen.set(p.id, p));
        return Array.from(seen.values()).map((p: any) => {
          const tags = Array.isArray(p.tags) ? p.tags : [];
          const tagHit = tags.find((t: string) => t.toLowerCase().includes(tag));
          const title = tagHit ? `#${tagHit}` : String(p.body_text ?? '').slice(0, 56) || 'Post';
          return {
            type: 'post' as const,
            title,
            subtitle: 'Post',
            href: tagHit
              ? `/search?filter=posts&q=${encodeURIComponent(tagHit)}`
              : `/search?filter=posts&q=${encodeURIComponent(q)}`,
          };
        });
      })
    );
  }

  const settled = await Promise.allSettled(tasks);
  const seen = new Set<string>();
  const items = settled
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .filter((item) => {
      const key = `${item.type}:${item.href}:${item.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);

  return NextResponse.json({ items }, { headers: CACHE_HEADERS });
}
