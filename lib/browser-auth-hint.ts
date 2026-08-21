import { parseProSessionHintCookie } from "@/lib/pro-session-hint";

/**
 * Cheap client-only signal that a doctor session may exist.
 * Used so public patient pages can skip the Auth round-trip unless the browser
 * already has a Supabase token or the first-party professional session hint.
 */
export function hasBrowserAuthHint(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (parseProSessionHintCookie(document.cookie)) return true;
    if (/(?:^|; )sb-[^=]*auth-token/.test(document.cookie)) return true;
  } catch {
    // Ignore cookie access errors (privacy mode).
  }

  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.includes("auth-token")) return true;
    }
  } catch {
    // Ignore storage access errors (privacy mode / iframe).
  }

  return false;
}
