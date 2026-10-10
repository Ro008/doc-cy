// middleware.ts
import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";
import {createMiddlewareClient} from "@supabase/auth-helpers-nextjs";

import createMiddleware from "next-intl/middleware";
import {routing} from "./i18n/routing";
import {parseAuthTokenClaims} from "./lib/auth-token-claims";
import {isSessionRevokedByPolicy} from "./lib/auth-session-revocation";
import {
  canonicalFinderSpecialtyRedirectPath,
  FINDER_DISTRICT_PATH_SLUGS,
  isLegacyFinderFilterPath,
  legacyFinderFilterToPublicPath,
} from "./lib/finder-public-path";
import {
  needsSupabaseSessionMiddleware,
  shouldSkipSupabaseSessionRefresh,
} from "./lib/needs-supabase-session-middleware";
import {adminSignInPath} from "./lib/admin-sign-in-flow";
import {isDoctorProductPath} from "./lib/doctor-routes";
import {agendaRedirectForLogin} from "./lib/registration-status-path";
import {
  amrFromAccessToken,
  hasValidEmailStep,
  isProfessionalApiPath,
} from "./lib/professional-email-step";

const handleI18nRouting = createMiddleware(routing);

const RESERVED_TOP_LEVEL = new Set([
  "agenda",
  "settings",
  // Patient link pages: /booking/confirm, /booking/choose, /booking/cancel, /booking/review.
  "booking",
  "blog",
  "clinics",
  "dashboard",
  "finder",
  "for-professionals",
  "internal",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "auth",
  "terms",
  "privacy",
  ...FINDER_DISTRICT_PATH_SLUGS,
]);

function isPublicPatientRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  const first = segments[0];
  const firstIsLocale = (routing.locales as readonly string[]).includes(first);

  // Localized public routes: /{locale}/{slug}, /{locale}/{slug}/request-sent, legacy /success
  if (firstIsLocale) {
    const rest = segments.slice(1);
    if (rest.length === 1) return true;
    if (
      rest.length === 2 &&
      (rest[1] === "request-sent" || rest[1] === "success")
    )
      return true;
    return false;
  }

  // Unprefixed public routes: /{slug}, /{slug}/request-sent, legacy /success
  if (RESERVED_TOP_LEVEL.has(first)) return false;
  // District filter paths are finder results, not doctor booking pages.
  if (FINDER_DISTRICT_PATH_SLUGS.has(first)) return false;
  if (segments.length === 1) return true;
  if (
    segments.length === 2 &&
    (segments[1] === "request-sent" || segments[1] === "success")
  )
    return true;

  return false;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // The professional's own API routes write through the service role, so the
  // database rule alone doesn't guard them: a session must carry the emailed
  // sign-in step (30 days). No session: the route answers 401 itself.
  if (isProfessionalApiPath(pathname)) {
    const res = NextResponse.next();
    const supabase = createMiddlewareClient({req, res});
    const {
      data: {session},
    } = await supabase.auth.getSession();
    if (session && !hasValidEmailStep(amrFromAccessToken(session.access_token))) {
      return NextResponse.json(
        {message: "Sign in again: we'll email you a sign-in link."},
        {status: 401},
      );
    }
    return res;
  }

  // Legacy /finder filter URLs → public unprefixed paths (keep /finder/professional|clinic for their own 301s).
  if (isLegacyFinderFilterPath(pathname)) {
    const publicPath = legacyFinderFilterToPublicPath(pathname);
    const dest = new URL(canonicalFinderSpecialtyRedirectPath(publicPath) ?? publicPath, req.url);
    dest.search = req.nextUrl.search;
    return NextResponse.redirect(dest, 308);
  }

  // Legacy specialty spellings / casing (`/all/gynecology`) → the catalogue slug.
  const canonicalSpecialtyPath = canonicalFinderSpecialtyRedirectPath(pathname);
  if (canonicalSpecialtyPath) {
    const dest = new URL(canonicalSpecialtyPath, req.url);
    dest.search = req.nextUrl.search;
    return NextResponse.redirect(dest, 308);
  }

  // Public finder district URLs (`/larnaca`, `/all/dentistry`) are real App Router
  // pages. Do not rewrite them — Next <Link> / router.push needs the real route.
  let res: NextResponse;
  if (isPublicPatientRoute(pathname)) {
    // Step 1: Apply next-intl routing only for public patient-facing booking pages.
    // Internal /agenda dashboard routes are intentionally left unprefixed.
    res = handleI18nRouting(req);
  } else {
    res = NextResponse.next();
  }

  // Refresh JWT + gate /agenda only on doctor product routes. Public finder,
  // clinics, and booking pages skip Auth so anonymous HTML is not blocked.
  if (
    needsSupabaseSessionMiddleware(pathname) &&
    !shouldSkipSupabaseSessionRefresh(pathname, req.method)
  ) {
    const supabase = createMiddlewareClient({req, res});
    const {
      data: {session},
    } = await supabase.auth.getSession();

    // Admin dashboard: no session → sign-in. The page itself checks the admin row
    // and the 2FA code (lib/admin-auth.ts); this only saves a render.
    if (pathname === "/internal/directory" || pathname.startsWith("/internal/directory/")) {
      if (!session) {
        return NextResponse.redirect(new URL(adminSignInPath(pathname), req.url));
      }
      return res;
    }

    if (isDoctorProductPath(pathname)) {
      if (!session) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(loginUrl);
      }

      const {data: doctorRow, error: doctorRowError} = await supabase
        .from("professionals")
        .select("auth_session_revoked_after, auth_keep_session_id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (doctorRowError && (doctorRowError as {code?: string}).code !== "42703") {
        console.error("[DocCy][auth] middleware_doctor_lookup_failed", doctorRowError);
      }

      // Applicants (registration pending or denied) see only the Status page.
      if (!doctorRowError) {
        const applicantRedirect = agendaRedirectForLogin(pathname, Boolean(doctorRow));
        if (applicantRedirect) return NextResponse.redirect(new URL(applicantRedirect, req.url));
      }

      // A professional's session needs the emailed step (password alone, or older
      // than 30 days, is not enough): sign in again.
      if (doctorRow && !hasValidEmailStep(amrFromAccessToken(session.access_token))) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("next", pathname);
        loginUrl.searchParams.set("signin", "again");
        return NextResponse.redirect(loginUrl);
      }

      const claims = parseAuthTokenClaims(session.access_token);
      if (claims.sessionId && doctorRow) {
        const revokedAfterRaw = (
          doctorRow as {auth_session_revoked_after?: string | null}
        ).auth_session_revoked_after;
        const keepSessionId = (
          doctorRow as {auth_keep_session_id?: string | null}
        ).auth_keep_session_id;

        const isRevoked = isSessionRevokedByPolicy({
          revokedAfterIso: revokedAfterRaw,
          keepSessionId,
          tokenIat: claims.iat,
          tokenSessionId: claims.sessionId,
        });

        if (isRevoked) {
          const loginUrl = new URL("/login", req.url);
          loginUrl.searchParams.set("next", pathname);
          return NextResponse.redirect(loginUrl);
        }
      }
    }
  }

  return res;
}

export const config = {
  // Pages (exclude api/_next/_vercel and dot-files), plus the professional's own API
  // routes (keep in sync with isProfessionalApiPath in lib/professional-email-step.ts).
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
    "/api/appointments/:path+",
    "/api/doctor-gesy",
    "/api/doctor-locations",
    "/api/doctor-online-bookings",
    "/api/doctor-services",
    "/api/doctor-settings/:path*",
    "/api/professional-clinics/:path*",
    "/api/professional-mobile/:path*",
    "/api/name-change-requests",
    "/api/photo-change-requests",
    "/api/professional-photo",
    "/api/professional-specialties",
    "/api/specialty-requests",
  ],
};
