import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
} from "@/lib/password-reset";

/**
 * Completes the Supabase recovery redirect (PKCE `code`, or email `token_hash`)
 * then sends the professional to choose a new password.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code")?.trim() || "";
  const tokenHash = requestUrl.searchParams.get("token_hash")?.trim() || "";
  const type = requestUrl.searchParams.get("type")?.trim() || "";

  const supabase = createRouteHandlerClient({ cookies });
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) {
      console.error("[DocCy] password reset code exchange failed", error.message);
    }
  } else if (tokenHash && (type === "recovery" || type === "magiclink" || type === "email")) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "magiclink" | "email",
      token_hash: tokenHash,
    });
    ok = !error;
    if (error) {
      console.error("[DocCy] password reset otp verify failed", error.message);
    }
  }

  if (code || tokenHash) {
    const dest = ok ? RESET_PASSWORD_PATH : `${FORGOT_PASSWORD_PATH}?error=invalid`;
    return NextResponse.redirect(new URL(dest, requestUrl.origin));
  }

  // Hash tokens (`#access_token`) are applied on the reset page by the browser client.
  return NextResponse.redirect(new URL(RESET_PASSWORD_PATH, requestUrl.origin));
}
