// Username rules (pure helpers — safe on client and server).
// 3–20 chars: lowercase letters, numbers, periods, underscores.
// Uniqueness is enforced case-insensitively in the actions.

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < 3) return 'Username must be at least 3 characters.';
  if (u.length > 20) return 'Username must be 20 characters or fewer.';
  if (!/^[a-z0-9_.]+$/.test(u)) {
    return 'Use only letters, numbers, periods, and underscores.';
  }
  return null;
}
