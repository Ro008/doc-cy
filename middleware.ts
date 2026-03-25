// middleware.ts
import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";
import {createMiddlewareClient} from "@supabase/auth-helpers-nextjs";

import createMiddleware from "next-intl/middleware";
import {routing} from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

const RESERVED_TOP_LEVEL = new Set([
  "agenda",
  "dashboard",
  "internal",
  "login",
  "register",
]);

function isPublicPatientRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  const first = segments[0];
  const firstIsLocale = (routing.locales as readonly string[]).includes(first);

  // Localized public routes: /{locale}/{slug} and /{locale}/{slug}/success
  if (firstIsLocale) {
    const rest = segments.slice(1);
    if (rest.length === 1) return true;
    if (rest.length === 2 && rest[1] === "success") return true;
    return false;
  }

  // Unprefixed public routes: /{slug} and /{slug}/success
  if (RESERVED_TOP_LEVEL.has(first)) return false;
  if (segments.length === 1) return true;
  if (segments.length === 2 && segments[1] === "success") return true;

  return false;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Step 1: Apply next-intl routing only for public patient-facing booking pages.
  // Internal /agenda dashboard routes are intentionally left unprefixed.
  const res = isPublicPatientRoute(pathname)
    ? handleI18nRouting(req)
    : NextResponse.next();

  // Step 2: Refresh Supabase session on every request so server components
  // (like /agenda) can see the authenticated user via cookies.
  const supabase = createMiddlewareClient({req, res});
  const {
    data: {session},
  } = await supabase.auth.getSession();

  // Protect /agenda and /agenda/*: require auth, redirect to login if no session
  if (pathname === "/agenda" || pathname.startsWith("/agenda/")) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Private internal directory (shared secret cookie; set via /internal gate)
  if (
    pathname === "/internal/directory" ||
    pathname.startsWith("/internal/directory/")
  ) {
    const secret = process.env.INTERNAL_DIRECTORY_SECRET?.trim();
    if (!secret) {
      // Don't send people to "/" — they think the app is broken. Explain on /internal.
      const gate = new URL("/internal", req.url);
      gate.searchParams.set("configure", "1");
      return NextResponse.redirect(gate);
    }

    const cookie = req.cookies.get("doccy-internal-directory")?.value;
    if (cookie !== secret) {
      const gate = new URL("/internal", req.url);
      gate.searchParams.set("next", "/internal/directory");
      return NextResponse.redirect(gate);
    }
  }

  return res;
}

export const config = {
  // Keep existing behavior: run on pages (exclude api/_next/_vercel and dot-files)
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
