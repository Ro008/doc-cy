import { isForgotPasswordPath, isResetPasswordPath } from "@/lib/password-reset";

/**
 * Middleware should call supabase.auth.getSession() only on routes that
 * need a refreshed JWT (auth gates, login redirect, doctor dashboard).
 *
 * Public patient traffic (`/`, `/clinics`, `/larnaca`, doctor slugs, blog)
 * must not pay an Auth round-trip before HTML.
 */
export function needsSupabaseSessionMiddleware(pathname: string): boolean {
  const path = pathname.split("?")[0]?.split("#")[0] || pathname;
  if (path === "/agenda" || path.startsWith("/agenda/")) return true;
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return true;
  if (path === "/login" || path.startsWith("/login/")) return true;
  if (path === "/register" || path.startsWith("/register/")) return true;
  // `/auth/callback` and `/auth/confirm-email` — exchanging the token belongs
  // in the route handler, not middleware.
  if (isForgotPasswordPath(path) || isResetPasswordPath(path)) return true;
  return false;
}

/**
 * Server-action POSTs to `/register` have no session yet. Refreshing Auth in
 * middleware on that request can stall the action so the submitting overlay
 * never clears.
 */
export function shouldSkipSupabaseSessionRefresh(pathname: string, method: string): boolean {
  if (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD") return false;
  const path = pathname.split("?")[0]?.split("#")[0] || pathname;
  return path === "/register" || path.startsWith("/register/");
}
