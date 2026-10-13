/** Safe internal post-login path (blocks open redirects). */
export function safeAuthNextPath(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  if (value.includes("\\")) return null;
  return value;
}

/** A plain anchor, as `/help#dashboard`: the same characters an element id can have here. */
const PLAIN_FRAGMENT = /^#[A-Za-z0-9._~-]{1,100}$/;

/**
 * Adds the login page's own `#fragment` to the path she was heading for, so a shared link such as
 * /help#dashboard still lands on its section after signing in. A fragment is never sent to the
 * server, so the middleware's `next=/help` cannot carry it; the browser keeps it on the login page
 * across the redirect and the login form reads it. Anything but a plain anchor is ignored, and a
 * path that already has a fragment keeps it.
 */
export function withFragment(
  nextPath: string | null | undefined,
  hash: string | null | undefined,
): string | null {
  const path = String(nextPath ?? "");
  if (!path) return null;
  if (path.includes("#")) return path;
  if (!hash || !PLAIN_FRAGMENT.test(hash)) return path;
  return `${path}${hash}`;
}
