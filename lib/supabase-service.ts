import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the service role key.
 * Use only for trusted server code: internal tools, public booking API (RLS blocks anon reads
 * on appointments), calendar/request-sent pages that load a booking by id, etc.
 */
/**
 * A fetch that never reuses an answer Next saved earlier. A GET route that reads no
 * cookies has its Supabase reads saved (seen 2026-10-11: the clinic search kept
 * answering as before a clinic was approved).
 */
export const freshFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

export function createServiceRoleClient(options?: { fresh?: boolean }): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(options?.fresh ? { global: { fetch: freshFetch } } : {}),
  });
}
