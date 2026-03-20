import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

type DoctorAuthResult = {
  authUserId: string;
  // Useful when callers need to query doctor-specific rows.
  sessionAccessToken: string;
};

function chunkString(value: string, chunkSize: number): string[] {
  if (value.length <= chunkSize) return [value];
  return value.match(new RegExp(`.{1,${chunkSize}}`, "g")) ?? [];
}

/**
 * Programmatic doctor login for Playwright:
 * - Uses Supabase `signInWithPassword` (server-side, deterministic).
 * - Injects the Supabase auth session cookies in the browser.
 *
 * This avoids flakiness from UI form submit + middleware redirects.
 */
export async function signInDoctorAndSetCookies(
  page: Page,
  supabaseClient?: SupabaseClient
): Promise<DoctorAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    throw new Error("Missing TEST_USER_EMAIL / TEST_USER_PASSWORD");
  }

  const supabase =
    supabaseClient ?? createClient(supabaseUrl, supabaseAnonKey);

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

  if (signInError) {
    throw signInError;
  }

  const session = signInData?.session;
  const authUserId =
    signInData?.user?.id ?? session?.user?.id ?? (session as any)?.user?.id;

  if (!session || !authUserId) {
    throw new Error("Supabase sign-in succeeded but session/user missing.");
  }

  // Supabase auth helpers store the session in a cookie keyed by `storageKey`:
  // sb-${baseUrl.hostname.split(".")[0]}-auth-token
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

  // @supabase/auth-helpers-shared stringifySupabaseSession(session)
  // => JSON.stringify([ access_token, refresh_token, provider_token, provider_refresh_token, factors ])
  const sessionCookieValue = JSON.stringify([
    session.access_token,
    session.refresh_token,
    (session as any).provider_token,
    (session as any).provider_refresh_token,
    session.user?.factors ?? null,
  ]);

  const chunkSize = 3180; // matches @supabase/auth-helpers-shared MAX_CHUNK_SIZE
  const chunks = chunkString(sessionCookieValue, chunkSize);

  await page.context().addCookies(
    chunks.map((chunkValue, idx) => {
      const name = chunks.length === 1 ? storageKey : `${storageKey}.${idx}`;
      return {
        name,
        value: chunkValue,
        httpOnly: true,
        sameSite: "Lax",
        domain: "localhost",
        path: "/",
      };
    })
  );

  return { authUserId, sessionAccessToken: session.access_token };
}

