import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { coverUrl } from '@/lib/openlibrary';
import { likeList, unlikeList, deleteList, removeBookFromList } from '@/app/actions/lists';

export const dynamic = 'force-dynamic';

export default async function ListDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: list } = await supabase
    .from('lists')
    .select('id, owner_id, title, description, genre, is_system')
    .eq('id', params.id)
    .maybeSingle();
  if (!list) notFound();

  const isOwner = !!user && user.id === list.owner_id;

  let ownerUname: string | null = null;
  if (list.owner_id) {
    const { data: o } = await supabase.from('profiles').select('username').eq('id', list.owner_id).maybeSingle();
    ownerUname = o?.username ?? null;
  }

  const { data: items } = await supabase
    .from('list_items')
    .select('book_id, position, books ( title, author, cover_id )')
    .eq('list_id', list.id)
    .order('position', { ascending: true });
  const books = items ?? [];

  const { data: likeRows } = await supabase.from('list_likes').select('user_id').eq('list_id', list.id);
  const likeCount = (likeRows ?? []).length;
  const liked = !!user && (likeRows ?? []).some((r: any) => r.user_id === user.id);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            {list.is_system ? 'Genre list' : ownerUname ? <>List by <Link href={`/u/${ownerUname}`} className="text-brand hover:underline">@{ownerUname}</Link></> : 'List'}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{list.title}</h1>
          {list.description && <p className="mt-1 max-w-prose whitespace-pre-wrap text-sm text-stone-600">{list.description}</p>}
          <p className="mt-1 text-sm text-stone-400">{books.length} book{books.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {user && (
            <form action={liked ? unlikeList : likeList}>
              <input type="hidden" name="listId" value={list.id} />
              <button className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition ${liked ? 'border-brand bg-brand text-white' : 'border-stone-300 text-stone-700 hover:border-brand hover:text-brand'}`}>
                {liked ? '♥' : '♡'} {likeCount}
              </button>
            </form>
          )}
          {isOwner && (
            <form action={deleteList}>
              <input type="hidden" name="listId" value={list.id} />
              <button className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-600 hover:border-red-400 hover:text-red-600">Delete</button>
            </form>
          )}
        </div>
      </div>

      {books.length === 0 ? (
        <p className="mt-8 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
          {isOwner ? 'No books yet — open any book and use “Add to list”.' : 'This list is empty.'}
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {books.map((it: any) => {
            const src = coverUrl(it.books?.cover_id, 'M');
            return (
              <li key={it.book_id} className="group relative">
                <Link href={`/book/${it.book_id}`} className="flex flex-col">
                  <div className="aspect-[2/3] w-full overflow-hidden rounded bg-stone-100 group-hover:opacity-90">
                    {src && <Image src={src} alt={it.books?.title ?? ''} width={200} height={300} className="h-full w-full object-cover" />}
                  </div>
                  <p className="mt-1 truncate text-xs font-medium">{it.books?.title}</p>
                  <p className="truncate text-[11px] text-stone-500">{it.books?.author}</p>
                </Link>
                {isOwner && (
                  <form action={removeBookFromList} className="absolute right-1 top-1">
                    <input type="hidden" name="listId" value={list.id} />
                    <input type="hidden" name="bookId" value={it.book_id} />
                    <button title="Remove" className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-stone-500 shadow hover:text-red-600">×</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
