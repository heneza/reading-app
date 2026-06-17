import { createClient } from '@supabase/supabase-js';

// =====================================================================
// SERVER-ONLY service-role client.
//
// Uses SUPABASE_SERVICE_ROLE_KEY, which BYPASSES Row Level Security and
// can read privileged tables (e.g. auth.users). It must NEVER be imported
// into a Client Component or shipped to the browser, and its results must
// never be returned to the client unfiltered. Only call it from Server
// Actions / Route Handlers for narrowly-scoped, trusted lookups.
// =====================================================================
export function createAdminClient() {
  // Defence in depth: refuse to construct this in a browser bundle.
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient() must only be used on the server.');
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
