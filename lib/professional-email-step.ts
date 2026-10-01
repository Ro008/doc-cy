/**
 * Sign-in for approved professionals (user, 2026-09-29): password, then the link or
 * code emailed to her. Supabase marks a session made from the link or code (and from
 * a password reset) with an `amr` entry `{ method: "otp", timestamp }`; the session
 * counts for 30 days from that mark. A password alone never does.
 *
 * The database enforces the same rule (`professional_session_email_step_verified()`).
 * No imports: the middleware bundle uses this.
 */

export const EMAIL_STEP_MAX_AGE_DAYS = 30;

const DAY_SECONDS = 86_400;
/** Allowed clock skew between Supabase's timestamps and this server. */
const CLOCK_SKEW_SECONDS = 300;

export const SIGN_IN_LINK_PATH = "/auth/sign-in-link";

/** Newest email-step time (Unix seconds) in a JWT `amr` claim, or null. */
export function lastEmailStepAt(amr: unknown): number | null {
  if (!Array.isArray(amr)) return null;
  let latest: number | null = null;
  for (const entry of amr) {
    if (!entry || typeof entry !== "object") continue;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    if (method !== "otp" || typeof timestamp !== "number" || !Number.isFinite(timestamp)) continue;
    if (latest === null || timestamp > latest) latest = timestamp;
  }
  return latest;
}

export function hasValidEmailStep(
  amr: unknown,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  maxAgeDays: number = EMAIL_STEP_MAX_AGE_DAYS,
): boolean {
  const at = lastEmailStepAt(amr);
  if (at === null) return false;
  if (at > nowSeconds + CLOCK_SKEW_SECONDS) return false;
  return nowSeconds - at <= maxAgeDays * DAY_SECONDS;
}

/** The `amr` claim of an access token (read only; the token was issued by Supabase). */
export function amrFromAccessToken(accessToken: string | null | undefined): unknown {
  const payload = String(accessToken ?? "").split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return (JSON.parse(atob(padded)) as { amr?: unknown }).amr ?? null;
  } catch {
    return null;
  }
}

const PROFESSIONAL_API_ROUTES = [
  "/api/doctor-avatar",
  "/api/doctor-gesy",
  "/api/doctor-locations",
  "/api/doctor-online-bookings",
  "/api/doctor-services",
  "/api/doctor-settings",
];

/**
 * The professional's own API routes (they write through the service role after
 * checking the session, so the database rule alone doesn't cover them). The bare
 * `/api/appointments` is patients' booking and stays open.
 */
export function isProfessionalApiPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  if (path.startsWith("/api/appointments/")) return true;
  return PROFESSIONAL_API_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

/** Digits of the emailed code (Supabase's length is a project setting: 6 to 10). */
export function normalizeSignInCode(input: string): string | null {
  const digits = String(input ?? "").replace(/[\s-]/g, "");
  return /^\d{6,10}$/.test(digits) ? digits : null;
}

export function signInLinkPath(tokenHash: string, next: string | null): string {
  const params = new URLSearchParams({ token_hash: tokenHash });
  if (next) params.set("next", next);
  return `${SIGN_IN_LINK_PATH}?${params.toString()}`;
}
