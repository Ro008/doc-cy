/**
 * First-party hint that a professional session may exist.
 * Not a secret: used only to avoid painting guest header CTAs before Auth resolves.
 * Public HTML still does not call Supabase Auth.
 */

export const PRO_SESSION_HINT_COOKIE = "doccy-pro-session";
export const PRO_SESSION_HINT_VALUE = "1";
export const PRO_SESSION_HINT_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

export function isProSessionHintValue(value: string | undefined | null): boolean {
  return String(value ?? "").trim() === PRO_SESSION_HINT_VALUE;
}

export function parseProSessionHintCookie(cookieSource: string): boolean {
  const parts = String(cookieSource ?? "").split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== PRO_SESSION_HINT_COOKIE) continue;
    return isProSessionHintValue(trimmed.slice(eq + 1));
  }
  return false;
}

function cookieSuffix(): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? ";Secure" : "";
  return `Path=/;SameSite=Lax${secure}`;
}

export function writeProSessionHintCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PRO_SESSION_HINT_COOKIE}=${PRO_SESSION_HINT_VALUE};${cookieSuffix()};Max-Age=${PRO_SESSION_HINT_MAX_AGE_SECONDS}`;
}

export function clearProSessionHintCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PRO_SESSION_HINT_COOKIE}=;${cookieSuffix()};Max-Age=0`;
}

export const PRO_CHROME_BOOT_ATTR = "data-doccy-pro-chrome";
export const PRO_CHROME_AGENDA_ATTR = "data-doccy-pro-chrome-agenda";
export const PRO_CHROME_HYDRATED_ATTR = "data-doccy-pro-chrome-hydrated";
export const PRO_CHROME_BOOT_TABS_ID = "doccy-pro-mobile-tabs-boot";
export const PRO_CHROME_BOOT_AVATAR_ID = "doccy-pro-desktop-avatar-boot";
export const PRO_CHROME_BOOT_STICKY_ID = "doccy-pro-sticky-header-boot";

/** Runs before React: show boot chrome if the session hint cookie exists. */
export function proChromeBootInlineScript(): string {
  const cookieEq = JSON.stringify(`${PRO_SESSION_HINT_COOKIE}=${PRO_SESSION_HINT_VALUE}`);
  const attr = JSON.stringify(PRO_CHROME_BOOT_ATTR);
  const agendaAttr = JSON.stringify(PRO_CHROME_AGENDA_ATTR);
  return `(function(){try{var p=location.pathname;if(p==="/login"||p.indexOf("/agenda/account-review")===0||p.indexOf("/dashboard/appointments/")===0)return;if(document.cookie.indexOf(${cookieEq})===-1)return;document.documentElement.setAttribute(${attr},"1");if(p.indexOf("/agenda")===0)document.documentElement.setAttribute(${agendaAttr},"1");}catch(e){}})();`;
}
