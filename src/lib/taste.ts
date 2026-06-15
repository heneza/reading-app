type TasteEntry = {
  book_id: string;
  rating: number | string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type TasteMatch = {
  percent: number;
  title: string;
};

const MAX_ENTRIES = 400;
const MAX_GENRE_BOOKS = 160;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function numericRating(value: TasteEntry['rating']) {
  if (value === null || value === undefined || value === '') return null;
  const rating = Number(value);
  return Number.isFinite(rating) ? rating : null;
}

function averageRating(entries: TasteEntry[]) {
  const ratings = entries
    .map((entry) => numericRating(entry.rating))
    .filter((rating): rating is number => rating !== null);
  if (ratings.length === 0) return 3.5;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function entryPreference(entry: TasteEntry, average: number) {
  const rating = numericRating(entry.rating);
  if (rating !== null) return clamp((rating - average) / 2, -1.25, 1.25);

  if (entry.status === 'dnf') return -0.45;
  if (entry.status === 'reading') return 0.25;
  if (entry.status === 'read') return 0.2;
  if (entry.status === 'want_to_read') return 0.08;
  return 0;
}

function topSignalBookIds(entries: TasteEntry[]) {
  const average = averageRating(entries);
  return entries
    .map((entry) => ({
      id: entry.book_id,
      signal: Math.abs(entryPreference(entry, average)),
    }))
    .filter((entry) => entry.id && entry.signal > 0.05)
    .sort((a, b) => b.signal - a.signal)
    .slice(0, MAX_GENRE_BOOKS)
    .map((entry) => entry.id);
}

function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0;
  let aMag = 0;
  let bMag = 0;

  a.forEach((value, key) => {
    dot += value * (b.get(key) ?? 0);
    aMag += value * value;
  });
  b.forEach((value) => {
    bMag += value * value;
  });

  if (aMag === 0 || bMag === 0) return null;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

function genreVector(
  entries: TasteEntry[],
  profileGenres: string[],
  genresByBook: Map<string, string[]>
) {
  const average = averageRating(entries);
  const vector = new Map<string, number>();

  profileGenres.forEach((genre) => {
    vector.set(genre, (vector.get(genre) ?? 0) + 1.1);
  });

  entries.forEach((entry) => {
    const genres = genresByBook.get(entry.book_id) ?? [];
    if (genres.length === 0) return;
    const preference = entryPreference(entry, average);
    if (Math.abs(preference) < 0.05) return;
    genres.forEach((genre) => {
      vector.set(genre, (vector.get(genre) ?? 0) + preference);
    });
  });

  return vector;
}

function ratingAgreement(viewerEntries: TasteEntry[], targetEntries: TasteEntry[]) {
  const targetByBook = new Map(targetEntries.map((entry) => [entry.book_id, entry]));
  const viewerAverage = averageRating(viewerEntries);
  const targetAverage = averageRating(targetEntries);
  let sharedBooks = 0;
  let sharedRated = 0;
  let total = 0;

  viewerEntries.forEach((viewerEntry) => {
    const targetEntry = targetByBook.get(viewerEntry.book_id);
    if (!targetEntry) return;
    sharedBooks += 1;

    const viewerRating = numericRating(viewerEntry.rating);
    const targetRating = numericRating(targetEntry.rating);
    if (viewerRating === null || targetRating === null) return;

    const centeredDiff = Math.abs(
      (viewerRating - viewerAverage) - (targetRating - targetAverage)
    );
    const rawDiff = Math.abs(viewerRating - targetRating);
    total +=
      0.6 * (1 - clamp(centeredDiff / 4)) +
      0.4 * (1 - clamp(rawDiff / 5));
    sharedRated += 1;
  });

  return {
    score: sharedRated > 0 ? total / sharedRated : null,
    sharedBooks,
    sharedRated,
  };
}

async function loadGenresByBook(supabase: any, bookIds: string[]) {
  const ids = Array.from(new Set(bookIds)).filter(Boolean);
  const genresByBook = new Map<string, string[]>();
  if (ids.length === 0) return genresByBook;

  const { data } = await supabase
    .from('book_genres')
    .select('book_id, genre')
    .in('book_id', ids);

  (data ?? []).forEach((row: any) => {
    const genres = genresByBook.get(row.book_id) ?? [];
    genres.push(row.genre);
    genresByBook.set(row.book_id, genres);
  });

  return genresByBook;
}

async function loadViewerTaste(supabase: any, viewerId: string) {
  const [entriesRes, genresRes] = await Promise.all([
    supabase
      .from('reading_entries')
      .select('book_id, rating, status, updated_at')
      .eq('user_id', viewerId)
      .order('updated_at', { ascending: false })
      .limit(MAX_ENTRIES),
    supabase
      .from('profile_genres')
      .select('genre')
      .eq('user_id', viewerId),
  ]);

  return {
    entries: (entriesRes.data ?? []) as TasteEntry[],
    profileGenres: ((genresRes.data ?? []) as any[]).map((row) => row.genre),
  };
}

function percentFromScore(score: number, confidence: number) {
  const softened = 0.5 + (score - 0.5) * clamp(confidence, 0.25, 1);
  return Math.round(clamp(softened) * 100);
}

function ratingLabel(score: number | null) {
  if (score === null) return 'limited';
  if (score >= 0.78) return 'high';
  if (score >= 0.6) return 'mixed';
  return 'low';
}

export async function computeUserTasteMatch(
  supabase: any,
  viewerId: string | null | undefined,
  targetId: string,
  targetEntries: TasteEntry[],
  targetProfileGenres: string[]
): Promise<TasteMatch | null> {
  if (!viewerId || viewerId === targetId) return null;

  const [{ entries: viewerEntries, profileGenres: viewerGenres }] = await Promise.all([
    loadViewerTaste(supabase, viewerId),
  ]);
  const boundedTargetEntries = targetEntries.slice(0, MAX_ENTRIES);
  if (
    viewerEntries.length === 0 &&
    viewerGenres.length === 0 &&
    boundedTargetEntries.length === 0 &&
    targetProfileGenres.length === 0
  ) {
    return null;
  }

  const agreement = ratingAgreement(viewerEntries, boundedTargetEntries);
  const genreBookIds = [
    ...topSignalBookIds(viewerEntries),
    ...topSignalBookIds(boundedTargetEntries),
  ];
  const genresByBook = await loadGenresByBook(supabase, genreBookIds);
  const viewerVector = genreVector(viewerEntries, viewerGenres, genresByBook);
  const targetVector = genreVector(boundedTargetEntries, targetProfileGenres, genresByBook);
  const rawGenreScore = cosine(viewerVector, targetVector);
  const genreScore = rawGenreScore === null ? null : 0.5 + rawGenreScore * 0.5;

  const sharedGenres = Array.from(viewerVector.keys()).filter((genre) =>
    Math.abs(targetVector.get(genre) ?? 0) > 0.1
  ).length;
  const overlapScore =
    agreement.sharedBooks > 0
      ? clamp(agreement.sharedBooks / Math.max(8, Math.min(viewerEntries.length, boundedTargetEntries.length)))
      : null;

  const parts: { score: number; weight: number }[] = [];
  if (agreement.score !== null) {
    parts.push({ score: agreement.score, weight: agreement.sharedRated >= 3 ? 0.5 : 0.35 });
  }
  if (genreScore !== null) parts.push({ score: genreScore, weight: 0.35 });
  if (overlapScore !== null) parts.push({ score: overlapScore, weight: 0.15 });
  if (parts.length === 0) return null;

  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  const score = parts.reduce((sum, part) => sum + part.score * part.weight, 0) / weight;
  const confidence = clamp(
    agreement.sharedRated / 8 * 0.5 +
      agreement.sharedBooks / 20 * 0.2 +
      sharedGenres / 8 * 0.3,
    0.25,
    1
  );

  return {
    percent: percentFromScore(score, confidence),
    title: `Shared books: ${agreement.sharedBooks}; ratings: ${ratingLabel(agreement.score)}`,
  };
}

export async function computeBookTasteMatch(
  supabase: any,
  viewerId: string | null | undefined,
  bookId: string,
  bookGenres: string[]
): Promise<TasteMatch | null> {
  if (!viewerId || bookGenres.length === 0) return null;

  const { entries, profileGenres } = await loadViewerTaste(supabase, viewerId);
  if (entries.length === 0 && profileGenres.length === 0) return null;

  const genreBookIds = topSignalBookIds(entries).filter((id) => id !== bookId);
  const genresByBook = await loadGenresByBook(supabase, genreBookIds);
  const viewerVector = genreVector(entries, profileGenres, genresByBook);
  const bookVector = new Map(bookGenres.map((genre) => [genre, 1]));
  const rawScore = cosine(viewerVector, bookVector);
  if (rawScore === null) return null;

  const sharedSignals = bookGenres.filter((genre) =>
    Math.abs(viewerVector.get(genre) ?? 0) > 0.1
  ).length;
  if (sharedSignals === 0) return null;

  const score = 0.5 + rawScore * 0.5;
  const confidence = clamp(sharedSignals / Math.max(2, bookGenres.length), 0.35, 1);

  return {
    percent: percentFromScore(score, confidence),
    title: `Shared tags: ${sharedSignals}`,
  };
}
