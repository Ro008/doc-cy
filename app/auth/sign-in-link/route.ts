import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { safeAuthNextPath } from "@/lib/auth-redirect";
import { postLoginDestination } from "@/lib/doctor-routes";
import {
  PRO_SESSION_HINT_COOKIE,
  PRO_SESSION_HINT_MAX_AGE_SECONDS,
  PRO_SESSION_HINT_VALUE,
} from "@/lib/pro-session-hint";

/**
 * A relative redirect: the browser stays on the host it used. `request.url` carries
 * the server's own host in a production build (CI opens 127.0.0.1, the server says
 * localhost), and the session cookie belongs to the host the browser used.
 */
function redirectTo(pathWithQuery: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: pathWithQuery } });
}

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
    const params = new URLSearchParams({ link: "invalid" });
    if (next) params.set("next", next);
    return redirectTo(`/login?${params.toString()}`);
  };
  if (!tokenHash) return refused();

  const supabase = createRouteHandlerClient({ cookies });
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) {
    console.warn("[DocCy][auth] sign_in_link_refused", error.message);
    return refused();
  }

  const response = redirectTo(postLoginDestination(next));
  // Professional chrome from first paint on the next pages (only professionals get links).
  response.cookies.set(PRO_SESSION_HINT_COOKIE, PRO_SESSION_HINT_VALUE, {
    path: "/",
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    maxAge: PRO_SESSION_HINT_MAX_AGE_SECONDS,
  });
  return response;
}
