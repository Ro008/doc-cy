import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  registerSubmittedEmailConfirmErrorPath,
  registerSubmittedEmailConfirmedPath,
} from "@/lib/register-email-confirm";
import { notifyFounderAfterRegisterEmailConfirm } from "@/lib/notify-founder-after-email-confirm";
import { confirmRegistrationDraft } from "@/lib/registration-draft-confirm";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Completes the signup email magic link (`token_hash` from the DocCy Resend email).
 * Confirms the address, moves the registration draft into the founders' review
 * queue (and emails them), then signs out — they still wait for the review.
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
    const service = createServiceRoleClient();
    try {
      const moved = service ? await confirmRegistrationDraft(service, authUserId) : null;
      // Registered on the old path (a professional row, no draft): notify as before.
      if (!moved?.requestId) {
        await notifyFounderAfterRegisterEmailConfirm(authUserId);
      }
    } catch (confirmError) {
      // The daily purge moves a confirmed draft that is still waiting.
      console.error("[DocCy] Registration confirm after email confirm failed", confirmError);
    }
  }

  try {
    await supabase.auth.signOut();
  } catch (signOutError) {
    console.error("[DocCy] register email confirm sign-out failed", signOutError);
  }

  return ok();
}
