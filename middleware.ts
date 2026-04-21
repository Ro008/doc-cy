// middleware.ts
import {NextResponse} from "next/server";
import type {NextFetchEvent, NextRequest} from "next/server";
import {createMiddlewareClient} from "@supabase/auth-helpers-nextjs";

import createMiddleware from "next-intl/middleware";
import {routing} from "./i18n/routing";
import {isLikelyBotUserAgent} from "./lib/bot-user-agent";
import {shouldSuppressTrafficLog} from "./lib/traffic-log";
import {parseAuthTokenClaims} from "./lib/auth-token-claims";
import {isSessionRevokedByPolicy} from "./lib/auth-session-revocation";

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
  if (segments.length === 1) return true;
  if (
    segments.length === 2 &&
    (segments[1] === "request-sent" || segments[1] === "success")
  )
    return true;

  return false;
}

const TRAFFIC_SESSION_COOKIE = "doccy-traffic-session";

function shouldTrackTraffic(pathname: string): boolean {
  if (pathname.startsWith("/internal")) return false;
  if (pathname.startsWith("/agenda")) return false;
  if (pathname.startsWith("/dashboard")) return false;
  return true;
}

function buildTrafficOrigin(req: NextRequest): {origin: "direct" | "ref"; refCode: string | null} {
  const ref = req.nextUrl.searchParams.get("ref")?.trim();
  if (ref) return {origin: "ref", refCode: ref.slice(0, 80)};
  return {origin: "direct", refCode: null};
}

function trimUtm(value: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  return v.slice(0, 80);
}

const MAX_USER_AGENT_LEN = 512;

function queueTrafficLog(req: NextRequest, sessionId: string, event: NextFetchEvent) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return;

  const rawUa = req.headers.get("user-agent");
  const userAgent =
    rawUa && rawUa.trim() ? rawUa.trim().slice(0, MAX_USER_AGENT_LEN) : null;
  const isBot = isLikelyBotUserAgent(userAgent);

  const {origin, refCode} = buildTrafficOrigin(req);
  const payload = {
    session_id: sessionId,
    page_path: req.nextUrl.pathname,
    traffic_origin: origin,
    ref_code: refCode,
    utm_source: trimUtm(req.nextUrl.searchParams.get("utm_source")),
    utm_medium: trimUtm(req.nextUrl.searchParams.get("utm_medium")),
    city: req.headers.get("x-vercel-ip-city"),
    country: req.headers.get("x-vercel-ip-country"),
    user_agent: userAgent,
    is_bot: isBot,
    created_at: new Date().toISOString(),
  };

  const endpoint = `${url.replace(/\/+$/, "")}/rest/v1/website_visits`;
  event.waitUntil(
    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    }).catch(() => undefined)
  );
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
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

    const claims = parseAuthTokenClaims(session.access_token);
    if (claims.sessionId) {
      const {data: doctorAuth, error: doctorAuthError} = await supabase
        .from("doctors")
        .select("auth_session_revoked_after, auth_keep_session_id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!doctorAuthError && doctorAuth) {
        const revokedAfterRaw = (
          doctorAuth as {auth_session_revoked_after?: string | null}
        ).auth_session_revoked_after;
        const keepSessionId = (
          doctorAuth as {auth_keep_session_id?: string | null}
        ).auth_keep_session_id;

        const isRevoked = isSessionRevokedByPolicy({
          revokedAfterIso: revokedAfterRaw,
          keepSessionId,
          tokenIat: claims.iat,
          tokenSessionId: claims.sessionId,
        });

        if (isRevoked) {
          const loginUrl = new URL("/login", req.url);
          return NextResponse.redirect(loginUrl);
        }
      } else if ((doctorAuthError as {code?: string} | null)?.code !== "42703") {
        console.error("[DocCy][auth] middleware_revocation_check_failed", doctorAuthError);
      }
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

  if (req.method === "GET" && shouldTrackTraffic(pathname) && !shouldSuppressTrafficLog(req)) {
    const existing = req.cookies.get(TRAFFIC_SESSION_COOKIE)?.value?.trim();
    const sessionId = existing || crypto.randomUUID();
    if (!existing) {
      res.cookies.set({
        name: TRAFFIC_SESSION_COOKIE,
        value: sessionId,
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    queueTrafficLog(req, sessionId, event);
  }

  return res;
}

export const config = {
  // Keep existing behavior: run on pages (exclude api/_next/_vercel and dot-files)
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
