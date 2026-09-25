import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { ADMIN_SIGN_IN_PATH } from "@/lib/admin-sign-in-flow";

/** Pre-2FA shared-code cookie; cleared so old browsers don't keep it. */
const LEGACY_INTERNAL_COOKIE = "doccy-internal-directory";

/**
 * Signs the admin out of this browser (their Supabase session). A browser form
 * post (the dashboard's Sign out button) gets a redirect to the sign-in page;
 * `fetch` callers get JSON.
 */
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.signOut({ scope: "local" });

  const wantsPage = (req.headers.get("accept") ?? "").includes("text/html");
  const res = wantsPage
    ? NextResponse.redirect(new URL(ADMIN_SIGN_IN_PATH, req.url), 303)
    : NextResponse.json({ ok: true });
  res.cookies.set(LEGACY_INTERNAL_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
