import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  registerSubmittedEmailConfirmErrorPath,
  registerSubmittedEmailConfirmedPath,
} from "@/lib/register-email-confirm";
import { notifyFounderAfterRegisterEmailConfirm } from "@/lib/notify-founder-after-email-confirm";

/**
 * Completes the signup email magic link (`token_hash` from the DocCy Resend email).
 * Confirms the address, notifies the founder for review, then signs out —
 * they still wait for credential verification.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash")?.trim() || "";
  const type = requestUrl.searchParams.get("type")?.trim() || "magiclink";
  const claimed = requestUrl.searchParams.get("claimed") === "1";

  const fail = () =>
    NextResponse.redirect(new URL(registerSubmittedEmailConfirmErrorPath(), requestUrl.origin));
  const ok = () =>
    NextResponse.redirect(
      new URL(registerSubmittedEmailConfirmedPath(claimed), requestUrl.origin),
    );

  if (!tokenHash) {
    return fail();
  }

  const otpType: "signup" | "email" | "magiclink" =
    type === "signup" || type === "email" || type === "magiclink" ? type : "magiclink";

  const supabase = createRouteHandlerClient({ cookies });
  const { data: verifyData, error } = await supabase.auth.verifyOtp({
    type: otpType,
    token_hash: tokenHash,
  });
  if (error) {
    console.error("[DocCy] register email confirm failed", error.message);
    return fail();
  }

  const authUserId =
    verifyData.user?.id ||
    (await supabase.auth.getUser()).data.user?.id ||
    "";
  if (authUserId) {
    try {
      await notifyFounderAfterRegisterEmailConfirm(authUserId);
    } catch (notifyError) {
      console.error("[DocCy] Founder notify after email confirm failed", notifyError);
    }
  }

  try {
    await supabase.auth.signOut();
  } catch (signOutError) {
    console.error("[DocCy] register email confirm sign-out failed", signOutError);
  }

  return ok();
}
