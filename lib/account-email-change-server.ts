import type { SupabaseClient } from "@supabase/supabase-js";

import {
  EMAIL_CHANGE_LINK_MINUTES,
  emailChangeConfirmUrl,
  emailChangeStartStatus,
  pendingEmailChangeFromRow,
  type PendingEmailChange,
} from "@/lib/account-email-change";
import {
  buildEmailChangeConfirmEmail,
  buildEmailChangedNoticeEmail,
  sendAccountSecurityEmail,
} from "@/lib/account-security-emails";
import {
  hashAppointmentLinkToken,
  isAppointmentLinkTokenShape,
  newAppointmentLinkToken,
} from "@/lib/appointment-link-token";

/**
 * Server side of Account → "Change email" (user, 2026-10-11); `service` is the
 * service-role client, and the caller has checked the session where one is needed.
 * The token travels only in the email; the database keeps its SHA-256.
 */

type Result = { status: number; message?: string };

/** Keep the change waiting and email its link to the new address. */
export async function startEmailChange(
  service: SupabaseClient,
  input: { professionalId: string; newEmail: string; siteUrl: string },
): Promise<Result> {
  const token = newAppointmentLinkToken();
  const { error } = await service.rpc("professional_email_change_start", {
    p_professional_id: input.professionalId,
    p_new_email: input.newEmail,
    p_token_hash: hashAppointmentLinkToken(token),
    p_minutes: EMAIL_CHANGE_LINK_MINUTES,
  });
  const refused = emailChangeStartStatus(error);
  if (refused.status !== 200) {
    if (refused.status === 500) console.error("[DocCy] email change start", error);
    return refused;
  }

  const sent = await sendAccountSecurityEmail(
    input.newEmail,
    buildEmailChangeConfirmEmail({
      confirmUrl: emailChangeConfirmUrl(input.siteUrl, token),
      minutes: EMAIL_CHANGE_LINK_MINUTES,
    }),
  );
  if (!sent) {
    // No link reached her, so nothing should be left waiting.
    await service.rpc("professional_email_change_cancel", { p_professional_id: input.professionalId });
    return { status: 502, message: "Could not send the email. Please try again." };
  }
  return { status: 200 };
}

export async function cancelEmailChange(service: SupabaseClient, professionalId: string): Promise<Result> {
  const { error } = await service.rpc("professional_email_change_cancel", { p_professional_id: professionalId });
  if (error) {
    console.error("[DocCy] email change cancel", error);
    return { status: 500, message: "Could not cancel. Please try again." };
  }
  return { status: 200 };
}

export async function loadPendingEmailChange(
  service: SupabaseClient,
  professionalId: string,
): Promise<PendingEmailChange | null> {
  const { data } = await service
    .from("professional_email_changes")
    .select("new_email, expires_at")
    .eq("professional_id", professionalId)
    .is("confirmed_at", null)
    .is("cancelled_at", null)
    .maybeSingle();
  return pendingEmailChangeFromRow(data as { new_email?: string; expires_at?: string } | null);
}

type WaitingChange = { professionalId: string; newEmail: string };

/** The change this link belongs to, when the link still works. Changes nothing. */
export async function findWaitingEmailChange(service: SupabaseClient, token: string): Promise<WaitingChange | null> {
  if (!isAppointmentLinkTokenShape(token)) return null;
  const { data } = await service
    .from("professional_email_changes")
    .select("professional_id, new_email, expires_at")
    .eq("token_hash", hashAppointmentLinkToken(token))
    .is("confirmed_at", null)
    .is("cancelled_at", null)
    .maybeSingle();
  const row = data as { professional_id?: string; new_email?: string; expires_at?: string } | null;
  if (!row?.professional_id || !pendingEmailChangeFromRow(row)) return null;
  return { professionalId: row.professional_id, newEmail: String(row.new_email) };
}

/**
 * The link was opened and confirmed: move the sign-in address (Supabase Auth) and the
 * address booking requests go to (`professional_email_change_confirm`, which records
 * it and signs her out on every device), then tell the old address. If the database refuses, the sign-in address is put
 * back, so the two never differ.
 */
export async function confirmEmailChange(
  service: SupabaseClient,
  input: { token: string; siteUrl: string },
): Promise<Result & { email?: string }> {
  const waiting = await findWaitingEmailChange(service, input.token);
  if (!waiting) return { status: 410 };

  const { data: professional } = await service
    .from("professionals")
    .select("auth_user_id")
    .eq("id", waiting.professionalId)
    .maybeSingle();
  const authUserId = String((professional as { auth_user_id?: string | null } | null)?.auth_user_id ?? "");
  if (!authUserId) return { status: 410 };

  const { data: before, error: readError } = await service.auth.admin.getUserById(authUserId);
  const oldEmail = String(before?.user?.email ?? "").trim();
  if (readError || !oldEmail) {
    console.error("[DocCy] email change: reading the sign-in user", readError);
    return { status: 500 };
  }

  const { error: authError } = await service.auth.admin.updateUserById(authUserId, {
    email: waiting.newEmail,
    email_confirm: true,
  });
  if (authError) {
    const taken = /already|registered|exists/i.test(String(authError.message ?? ""));
    if (!taken) console.error("[DocCy] email change: moving the sign-in address", authError);
    return { status: taken ? 409 : 500 };
  }

  const { error } = await service.rpc("professional_email_change_confirm", {
    p_token_hash: hashAppointmentLinkToken(input.token),
  });
  if (error) {
    const { error: revertError } = await service.auth.admin.updateUserById(authUserId, {
      email: oldEmail,
      email_confirm: true,
    });
    if (revertError) console.error("[DocCy] email change: putting the sign-in address back", revertError);
    if (error.code === "23505") return { status: 409 };
    if (error.code === "P0002") return { status: 410 };
    console.error("[DocCy] email change confirm", error);
    return { status: 500 };
  }

  await sendAccountSecurityEmail(
    oldEmail,
    buildEmailChangedNoticeEmail({ newEmail: waiting.newEmail, siteUrl: input.siteUrl }),
  );
  return { status: 200, email: waiting.newEmail };
}
