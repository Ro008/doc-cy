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
  return false;
}
