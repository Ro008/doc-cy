/**
 * Cloudflare Turnstile (user, 2026-10-11): before an online booking request is saved and its
 * confirmation email goes out, Cloudflare confirms a person filled the form, so DocCy can't be
 * used to mass-send emails. Widget "DocCy public forms" (Managed, mydoccy.com + www).
 *
 * Keys live in Vercel → Production only:
 * - NEXT_PUBLIC_TURNSTILE_SITE_KEY (public, the form loads the widget with it)
 * - TURNSTILE_SECRET_KEY (server only)
 * Without them (local, CI, previews) the check is off. For a local try, Cloudflare's test keys
 * always pass: site 1x00000000000000000000AA, secret 1x0000000000000000000000000000000AA.
 */

export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type Env = Record<string, string | undefined>;

/**
 * On only when both keys are set: with the secret alone the form would send no token and
 * every booking would be refused.
 */
export function turnstileEnforced(env: Env = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim() && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

/**
 * Vercel Production without both keys: the booking form runs unprotected. The booking route
 * logs a reminder until they are set (previews, CI and local stay quiet: off on purpose there).
 */
export function turnstileMissingInProduction(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "production" && !turnstileEnforced(env);
}

/** The public site key for the widget, or "" when the check is off. */
export function turnstileSiteKey(env: Env = process.env): string {
  return env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}

/**
 * The form's side: Cloudflare takes ~2s to hand over a token. When Send is pressed before
 * that (autofill, quick typists), wait for it instead of refusing; "" after `timeoutMs`.
 */
export async function waitForTurnstileToken(
  read: () => string,
  timeoutMs = 10_000,
  stepMs = 200,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let token = read();
  while (!token && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, stepMs));
    token = read();
  }
  return token;
}

/**
 * Asks Cloudflare whether the token from the form is good. Fails closed: a missing token, a
 * "no", or Cloudflare unreachable all count as not verified.
 */
export async function verifyTurnstileToken(
  token: unknown,
  ip: string,
  options: { secret?: string; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const response = typeof token === "string" ? token.trim() : "";
  const secret = (options.secret ?? process.env.TURNSTILE_SECRET_KEY ?? "").trim();
  if (!response || !secret) return false;

  const body = new URLSearchParams({ secret, response });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await (options.fetchImpl ?? fetch)(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data?.success === true;
  } catch {
    return false;
  }
}
