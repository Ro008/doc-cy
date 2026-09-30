import type { SupabaseClient } from "@supabase/supabase-js";

import { PROFESSIONAL_REGISTRATION_REQUEST_TYPE } from "@/lib/professional-registration-request";
import {
  registrationNotifyRecipients,
  type FounderRecipientRow,
} from "@/lib/registration-request-notify";
import { sendResendEmail } from "@/lib/resend";
import { getPublicBookingBaseUrl } from "@/lib/site-url";

/**
 * An applicant withdraws their own pending registration from the Status page:
 * the pending request of the signed-in login is closed by
 * request_withdraw_as_applicant (which releases any Founders' Club place), and
 * the founders are told it left the queue. Service role only; the caller passes
 * the login it read from the session.
 */

type HttpResult = { ok: true } | { ok: false; status: number; message: string };

export type WithdrawnRequest = {
  id: string;
  requester_name: string | null;
  requester_email: string | null;
  details: unknown;
};

export function buildRegistrationWithdrawnNotifyContent(input: {
  requestId: string;
  name: string;
  email: string;
  foundersClub: boolean;
  siteUrl?: string;
}): { subject: string; text: string } {
  const base = (input.siteUrl?.trim() || getPublicBookingBaseUrl()).replace(/\/$/, "");
  const lines = [
    `${input.name} withdrew their registration request. Nothing to review.`,
    "",
    `Email: ${input.email}`,
    `Founders' Club place: ${input.foundersClub ? "released" : "none held"}`,
    "",
    `Request id: ${input.requestId}`,
    `Requests: ${base}/internal/directory?tab=requests`,
  ];
  return { subject: `[WITHDRAWN] Registration request: ${input.name}`, text: lines.join("\n") };
}

function heldFoundersPlace(details: unknown): boolean {
  return Boolean(details && typeof details === "object" && (details as { founders_club?: unknown }).founders_club === true);
}

/** Emails the founders. Never throws. */
export async function notifyFoundersOfWithdrawal(service: SupabaseClient, request: WithdrawnRequest): Promise<void> {
  try {
    const email = String(request.requester_email ?? "");
    const { data: founders } = await service
      .from("admin_users")
      .select("email, role, is_active")
      .eq("role", "founder")
      .eq("is_active", true);
    const recipients = registrationNotifyRecipients({
      applicantEmail: email,
      founders: (founders ?? []) as FounderRecipientRow[],
      founderNotifyEmail: process.env.FOUNDER_NOTIFY_EMAIL,
    });
    if (recipients.length === 0) return;
    const { subject, text } = buildRegistrationWithdrawnNotifyContent({
      requestId: request.id,
      name: String(request.requester_name ?? "An applicant"),
      email,
      foundersClub: heldFoundersPlace(request.details),
    });
    await sendResendEmail({
      to: recipients.length === 1 ? recipients[0]! : recipients,
      subject,
      text,
      tags: [
        { name: "category", value: "founder-registration-withdrawn" },
        { name: "request_id", value: request.id.slice(0, 40) },
      ],
    });
  } catch (error) {
    console.error("[DocCy] registration withdrawn notify failed", error);
  }
}

export async function withdrawRegistrationRequest(
  service: SupabaseClient,
  authUserId: string,
  options: { notify?: (request: WithdrawnRequest) => Promise<void> } = {},
): Promise<HttpResult> {
  if (!authUserId) return { ok: false, status: 401, message: "Sign in to withdraw your application." };

  const { data: request, error: lookupError } = await service
    .from("request_log")
    .select("id, requester_name, requester_email, details")
    .eq("applicant_auth_user_id", authUserId)
    .eq("request_type", PROFESSIONAL_REGISTRATION_REQUEST_TYPE)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    console.error("[DocCy] withdraw: request lookup failed", lookupError.message);
    return { ok: false, status: 500, message: "Could not withdraw your application. Try again." };
  }
  if (!request) {
    return { ok: false, status: 409, message: "There is no application under review to withdraw." };
  }

  const { error } = await service.rpc("request_withdraw_as_applicant", {
    p_request_id: request.id,
    p_auth_user_id: authUserId,
  });
  if (error) {
    if (error.code === "55000") {
      return { ok: false, status: 409, message: "Your application was already decided. Reload the page." };
    }
    console.error("[DocCy] withdraw failed", error);
    return { ok: false, status: 500, message: "Could not withdraw your application. Try again." };
  }

  const notify = options.notify ?? ((row: WithdrawnRequest) => notifyFoundersOfWithdrawal(service, row));
  try {
    await notify(request as WithdrawnRequest);
  } catch (notifyError) {
    console.error("[DocCy] registration withdrawn notify failed", notifyError);
  }
  return { ok: true };
}
