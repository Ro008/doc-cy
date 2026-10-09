import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import {
  appointmentLinkUrl,
  hashAppointmentLinkToken,
  newAppointmentLinkToken,
} from "@/lib/appointment-link-token";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { parsePatientCancelNoticeHours, patientCancelDeadline } from "@/lib/patient-cancel-window";

/**
 * `appointment_links`: the links emailed to patients about an existing appointment
 * (pick a proposed time, cancel, review). Only the token's hash is stored; a link works
 * once (`used_at`) and expires. Issuing a new link of a purpose revokes the older unused
 * ones, so only the latest email works (e.g. after a reschedule).
 */

export type AppointmentLinkPurpose = "proposal" | "cancel" | "review";
export type AppointmentLinkState = "usable" | "used" | "expired" | "invalid";

export type AppointmentLinkRow = {
  id: string;
  appointment_id: string;
  purpose: AppointmentLinkPurpose;
  expires_at: string;
  used_at: string | null;
};

export function appointmentLinkState(
  link: { expires_at: string; used_at: string | null } | null | undefined,
  now: Date = new Date(),
): AppointmentLinkState {
  if (!link) return "invalid";
  if (link.used_at) return "used";
  return new Date(link.expires_at).getTime() > now.getTime() ? "usable" : "expired";
}

/** Marks every unused link of this purpose as used (they stop working). */
export async function revokeAppointmentLinks(
  service: SupabaseClient,
  appointmentId: string,
  purpose: AppointmentLinkPurpose,
  now: Date = new Date(),
): Promise<void> {
  const { error } = await service
    .from("appointment_links")
    .update({ used_at: now.toISOString() })
    .eq("appointment_id", appointmentId)
    .eq("purpose", purpose)
    .is("used_at", null);
  if (error) throw error;
}

/**
 * Stores a new link and returns its raw token. Older links of the purpose are revoked,
 * except for a reminder (keepOlder), so the link in the first email keeps working.
 */
export async function issueAppointmentLink(
  service: SupabaseClient,
  input: { appointmentId: string; purpose: AppointmentLinkPurpose; expiresAt: Date; keepOlder?: boolean },
  now: Date = new Date(),
): Promise<string> {
  if (!input.keepOlder) await revokeAppointmentLinks(service, input.appointmentId, input.purpose, now);
  const token = newAppointmentLinkToken();
  const { error } = await service.from("appointment_links").insert({
    appointment_id: input.appointmentId,
    purpose: input.purpose,
    token_hash: hashAppointmentLinkToken(token),
    expires_at: input.expiresAt.toISOString(),
  });
  if (error) throw error;
  return token;
}

export async function findAppointmentLink(
  service: SupabaseClient,
  token: string,
  purpose: AppointmentLinkPurpose,
): Promise<AppointmentLinkRow | null> {
  const { data, error } = await service
    .from("appointment_links")
    .select("id, appointment_id, purpose, expires_at, used_at")
    .eq("token_hash", hashAppointmentLinkToken(token))
    .eq("purpose", purpose)
    .maybeSingle();
  if (error) throw error;
  return (data as AppointmentLinkRow | null) ?? null;
}

/** Uses the link once (one guarded UPDATE, so two clicks can't both pass). */
export async function consumeAppointmentLink(
  service: SupabaseClient,
  linkId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { data, error } = await service
    .from("appointment_links")
    .update({ used_at: now.toISOString() })
    .eq("id", linkId)
    .is("used_at", null)
    .gt("expires_at", now.toISOString())
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export function patientCancelDeadlineLabel(visitIso: string, noticeHours: number): string {
  const deadline = patientCancelDeadline(visitIso, noticeHours);
  return format(appointmentToCyprusDate(deadline.toISOString()), "EEEE, d MMMM yyyy 'at' HH:mm", { locale: enUS });
}

/**
 * The cancel link for a confirmed visit's email. It stays valid until the visit starts,
 * so after the notice deadline the page can still show the clinic phone; the deadline
 * itself is checked when the patient uses it, with the professional's current setting.
 */
export async function issuePatientCancelLink(
  service: SupabaseClient,
  appointment: { id: string; professional_id: string; appointment_datetime: string },
  siteUrl: string,
  options: { keepOlder?: boolean } = {},
): Promise<{ url: string; deadlineLabel: string }> {
  const { data: settings } = await service
    .from("professional_settings")
    .select("patient_cancel_notice_hours")
    .eq("professional_id", appointment.professional_id)
    .maybeSingle();
  const noticeHours = parsePatientCancelNoticeHours(
    (settings as { patient_cancel_notice_hours?: number } | null)?.patient_cancel_notice_hours,
  );
  const token = await issueAppointmentLink(service, {
    appointmentId: appointment.id,
    purpose: "cancel",
    expiresAt: new Date(appointment.appointment_datetime),
    keepOlder: options.keepOlder,
  });
  return {
    url: appointmentLinkUrl(siteUrl, "cancel", token),
    deadlineLabel: patientCancelDeadlineLabel(appointment.appointment_datetime, noticeHours),
  };
}
