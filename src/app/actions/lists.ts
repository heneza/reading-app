'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { GENRES, genreName } from '@/lib/genres';
import { GENRE_SUBJECTS } from '@/lib/genre-subjects';
import { fetchSubjectWorks } from '@/lib/openlibrary';

const MIN_SEEDED_LIST_BOOKS = 6;
const SEEDED_LIST_BOOKS = 12;

async function myUsername(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase.from('profiles').select('username, is_admin').eq('id', userId).maybeSingle();
  return data;
}

// ---- User lists ------------------------------------------------------
export async function createList(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  const description = String(formData.get('description') ?? '').trim().slice(0, 500) || null;
  if (!title) redirect('/lists?error=' + encodeURIComponent('Give your list a title.'));

  const { data: list } = await supabase
    .from('lists')
    .insert({ owner_id: user.id, title, description })
    .select('id')
    .single();

  if (list) redirect(`/list/${list.id}`);
  redirect('/lists');
}

export async function deleteList(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const listId = String(formData.get('listId'));
  await supabase.from('lists').delete().eq('id', listId).eq('owner_id', user.id);
  const me = await myUsername(supabase, user.id);
  if (me?.username) redirect(`/u/${me.username}?tab=lists`);
  redirect('/lists');
}

export async function addBookToList(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const listId = String(formData.get('listId'));
  const bookId = String(formData.get('bookId'));
  if (!listId || !bookId) return;

  const { count } = await supabase
    .from('list_items')
    .select('id', { count: 'exact', head: true })
    .eq('list_id', listId);

  await supabase
    .from('list_items')
    .upsert({ list_id: listId, book_id: bookId, position: count ?? 0 }, { onConflict: 'list_id,book_id', ignoreDuplicates: true });

  revalidatePath(`/list/${listId}`);
  revalidatePath(`/book/${bookId}`);
}

export async function removeBookFromList(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const listId = String(formData.get('listId'));
  const bookId = String(formData.get('bookId'));
  await supabase.from('list_items').delete().eq('list_id', listId).eq('book_id', bookId);
  revalidatePath(`/list/${listId}`);
}

// ---- Likes -----------------------------------------------------------
export async function likeList(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const listId = String(formData.get('listId'));
  await supabase.from('list_likes').upsert({ list_id: listId, user_id: user.id }, { onConflict: 'list_id,user_id', ignoreDuplicates: true });
  revalidatePath(`/list/${listId}`);
  const me = await myUsername(supabase, user.id);
  if (me?.username) revalidatePath(`/u/${me.username}`);
}

export async function unlikeList(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const listId = String(formData.get('listId'));
  await supabase.from('list_likes').delete().eq('list_id', listId).eq('user_id', user.id);
  revalidatePath(`/list/${listId}`);
  const me = await myUsername(supabase, user.id);
  if (me?.username) revalidatePath(`/u/${me.username}`);
}

// ---- Genre seeding (founder only) ------------------------------------
// Seeds/refreshes one genre (formData.genre) or all genres from Open Library.
export async function seedGenreLists(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const me = await myUsername(supabase, user.id);
  if (!me?.is_admin) redirect('/lists');

  const onlySlug = String(formData.get('genre') ?? '').trim();
  const targets = onlySlug ? GENRES.filter((g) => g.slug === onlySlug) : GENRES;

  for (const g of targets) {
    const subject = GENRE_SUBJECTS[g.slug];
    if (!subject) continue;

    const works = (await fetchSubjectWorks(subject, 60)).filter((w) => w.coverId).slice(0, SEEDED_LIST_BOOKS);
    if (works.length < MIN_SEEDED_LIST_BOOKS) continue;

    // Upsert each work into the books cache, preserving order.
    const ids: string[] = [];
    for (const w of works) {
      const { data: book } = await supabase
        .from('books')
        .upsert(
          { ol_key: w.key, title: w.title, author: w.author ?? null, cover_id: w.coverId ?? null },
          { onConflict: 'ol_key' }
        )
        .select('id')
        .single();
      if (book?.id) ids.push(book.id);
    }
    if (ids.length < MIN_SEEDED_LIST_BOOKS) continue;

    // Find or create the system list for this genre.
    const { data: existing } = await supabase
      .from('lists')
      .select('id')
      .eq('genre', g.slug)
      .eq('is_system', true)
      .maybeSingle();

    let listId = existing?.id as string | undefined;
    if (!listId) {
      const { data: created } = await supabase
        .from('lists')
        .insert({
          owner_id: null,
          is_system: true,
          genre: g.slug,
          title: `Essential ${g.name}`,
          description: `The most popular ${g.name} books.`,
        })
        .select('id')
        .single();
      listId = created?.id;
    }
    if (!listId) continue;

    // Replace its items.
    await supabase.from('list_items').delete().eq('list_id', listId);
    await supabase.from('list_items').insert(ids.map((book_id, i) => ({ list_id: listId, book_id, position: i })));
  }

  revalidatePath('/lists');
  revalidatePath('/');
  redirect('/lists');
}
