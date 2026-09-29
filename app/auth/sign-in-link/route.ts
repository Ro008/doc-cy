import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { safeAuthNextPath } from "@/lib/auth-redirect";
import {
  PRO_SESSION_HINT_COOKIE,
  PRO_SESSION_HINT_MAX_AGE_SECONDS,
  PRO_SESSION_HINT_VALUE,
} from "@/lib/pro-session-hint";

/**
 * The link in "[DocCy] Your sign-in link": the professional's second sign-in step.
 * Supabase verifies the one-time token (1 hour, once) and creates her session,
 * marked "otp" in its `amr`, which the database and middleware require.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash")?.trim() || "";
  const next = safeAuthNextPath(requestUrl.searchParams.get("next"));

  const refused = () => {
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("link", "invalid");
    if (next) login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  };
  if (!tokenHash) return refused();

  const supabase = createRouteHandlerClient({ cookies });
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) {
    console.warn("[DocCy][auth] sign_in_link_refused", error.message);
    return refused();
  }

  const response = NextResponse.redirect(new URL(next ?? "/agenda", requestUrl.origin));
  // Professional chrome from first paint on the next pages (only professionals get links).
  response.cookies.set(PRO_SESSION_HINT_COOKIE, PRO_SESSION_HINT_VALUE, {
    path: "/",
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    maxAge: PRO_SESSION_HINT_MAX_AGE_SECONDS,
  });
  return response;
}
