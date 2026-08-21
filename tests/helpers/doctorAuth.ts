import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PRO_SESSION_HINT_COOKIE, PRO_SESSION_HINT_VALUE } from "@/lib/pro-session-hint";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

const TEST_DOCTOR_EMAIL = normalizeSecret(process.env.TEST_DOCTOR_EMAIL ?? "");
const TEST_DOCTOR_PASSWORD = normalizeSecret(process.env.TEST_DOCTOR_PASSWORD ?? "");
const TEST_USER_EMAIL = normalizeSecret(process.env.TEST_USER_EMAIL ?? "");
const TEST_USER_PASSWORD = normalizeSecret(process.env.TEST_USER_PASSWORD ?? "");

type CachedSession = {
  authUserId: string;
  sessionAccessToken: string;
  sessionCookieValue: string;
  createdAtMs: number;
};

const SESSION_CACHE_TTL_MS = 10 * 60 * 1000;
const sessionCache = new Map<string, CachedSession>();

type DoctorAuthResult = {
  authUserId: string;
  // Useful when callers need to query doctor-specific rows.
  sessionAccessToken: string;
};

export type DoctorAuthOptions = {
  email?: string;
  password?: string;
};

function isRetryableAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = String((error as { message?: unknown }).message ?? "")
    .trim()
    .toLowerCase();
  if (!message) return false;
  return (
    message.includes("database error querying schema") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = normalizeSecret(value ?? "");
    if (normalized) return normalized;
  }
  return "";
}

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
  supabaseClient?: SupabaseClient,
  options?: DoctorAuthOptions
): Promise<DoctorAuthResult> {
  // Cookie domain must match the site the test is running against.
  // - Local: http://localhost:3000  -> domain must be "localhost"
  // - Staging/Prod: https://mydoccy.com -> domain must match that hostname
  const configuredBaseUrl =
    process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const cookieDomain = new URL(configuredBaseUrl).hostname;
  const isHttps = configuredBaseUrl.startsWith("https://");

  const supabaseUrl =
    process.env.PLAYWRIGHT_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey =
    process.env.PLAYWRIGHT_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  const loginEmail = firstNonEmpty(
    options?.email,
    TEST_DOCTOR_EMAIL,
    TEST_USER_EMAIL
  );
  const loginPassword = firstNonEmpty(
    options?.password,
    TEST_DOCTOR_PASSWORD,
    TEST_USER_PASSWORD
  );
  if (!loginEmail || !loginPassword) {
    throw new Error(
      "Missing TEST_DOCTOR_EMAIL/TEST_DOCTOR_PASSWORD or TEST_USER_EMAIL/TEST_USER_PASSWORD"
    );
  }

  const cacheKey = `${supabaseUrl}::${loginEmail}`;

  const cached = sessionCache.get(cacheKey);
  const isCacheFresh =
    cached && Date.now() - cached.createdAtMs < SESSION_CACHE_TTL_MS;
  if (isCacheFresh) {
    const chunkSize = 3180;
    const chunks = chunkString(cached.sessionCookieValue, chunkSize);
    await page.context().addCookies(
      chunks.map((chunkValue, idx) => {
        const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
        const name = chunks.length === 1 ? storageKey : `${storageKey}.${idx}`;
        return {
          name,
          value: chunkValue,
          httpOnly: true,
          secure: isHttps,
          sameSite: "Lax" as const,
          domain: cookieDomain,
          path: "/",
        };
      })
    );
    return {
      authUserId: cached.authUserId,
      sessionAccessToken: cached.sessionAccessToken,
    };
  }

  const maxAttempts = 8;
  let signInData:
    | Awaited<ReturnType<SupabaseClient["auth"]["signInWithPassword"]>>["data"]
    | null = null;
  let signInError:
    | Awaited<ReturnType<SupabaseClient["auth"]["signInWithPassword"]>>["error"]
    | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const supabase = supabaseClient ?? createClient(supabaseUrl, supabaseAnonKey);
    const result = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    signInData = result.data;
    signInError = result.error;

    if (!signInError) {
      break;
    }
    const canRetry = isRetryableAuthError(signInError) && attempt < maxAttempts;
    if (!canRetry) {
      break;
    }
    await sleep(600 * attempt);
  }

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
        secure: isHttps,
        sameSite: "Lax",
        domain: cookieDomain,
        path: "/",
      };
    })
  );

  sessionCache.set(cacheKey, {
    authUserId,
    sessionAccessToken: session.access_token,
    sessionCookieValue,
    createdAtMs: Date.now(),
  });

  return { authUserId, sessionAccessToken: session.access_token };
}

/**
 * Auth-helpers cookies are httpOnly when injected in Playwright. The browser
 * client reads `document.cookie`, so tests that load public pages (finder,
 * for-professionals) need a readable copy.
 */
export async function exposeSupabaseAuthCookiesToClient(page: Page): Promise<void> {
  const supabaseUrl = (
    process.env.PLAYWRIGHT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).trim();
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / PLAYWRIGHT_SUPABASE_URL");
  }

  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").trim();
  const cookieDomain = new URL(baseUrl).hostname;
  const secure = baseUrl.startsWith("https://");

  const cookies = await page.context().cookies();
  const authCookies = cookies.filter(
    (cookie) => cookie.name === storageKey || cookie.name.startsWith(`${storageKey}.`),
  );
  if (authCookies.length === 0) {
    throw new Error("Supabase auth cookies were not set in browser context.");
  }

  await page.context().addCookies(
    authCookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookieDomain,
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "Lax",
    })),
  );

  await page.context().addCookies([
    {
      name: PRO_SESSION_HINT_COOKIE,
      value: PRO_SESSION_HINT_VALUE,
      domain: cookieDomain,
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "Lax",
    },
  ]);
}

