import { expect, type APIRequestContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { hashAppointmentLinkToken, newAppointmentLinkToken } from "@/lib/appointment-link-token";

/**
 * An online booking is two steps since 2026-10-04: POST /api/appointments saves a draft
 * and emails a link; POST /api/booking/confirm with that link's token creates the
 * REQUESTED appointment. The raw token only travels in the email, so specs swap the
 * draft's stored hash for one they know, then confirm through the real route.
 */

export type OnlineBookingPayload = {
  doctorId?: string;
  doctorSlug?: string;
  locationId?: string | null;
  appointmentLocal: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  reason: string;
  isNewPatient?: boolean;
  patientGender?: "female" | "male" | "prefer_not_to_say";
  patientBirthdate?: string;
};

/** The fields the form needs, with defaults for the ones older specs don't set. */
export function withBookingDefaults(payload: OnlineBookingPayload): Record<string, unknown> {
  return {
    isNewPatient: true,
    patientGender: "prefer_not_to_say",
    patientBirthdate: "1990-01-01",
    ...payload,
  };
}

/** Submits the form; on success, confirms the emailed link and returns the appointment. */
export async function submitAndConfirmOnlineBooking(
  request: APIRequestContext,
  admin: SupabaseClient,
  payload: OnlineBookingPayload,
): Promise<{ submitStatus: number; submitBody: string; confirmStatus?: number; appointmentId?: string }> {
  const submit = await request.post("/api/appointments", { data: withBookingDefaults(payload) });
  const submitBody = await submit.text();
  if (submit.status() !== 202) return { submitStatus: submit.status(), submitBody };

  const token = await takeOverLatestDraftLink(admin, payload.patientEmail);
  const confirm = await request.post("/api/booking/confirm", { data: { token } });
  const json = (await confirm.json().catch(() => ({}))) as { appointment?: { id?: string } };
  return {
    submitStatus: 202,
    submitBody,
    confirmStatus: confirm.status(),
    appointmentId: json.appointment?.id ? String(json.appointment.id) : undefined,
  };
}

/** Replaces the newest unconfirmed draft's token for this email with a known one. */
export async function takeOverLatestDraftLink(admin: SupabaseClient, patientEmail: string): Promise<string> {
  const { data: draft, error } = await admin
    .from("appointment_drafts")
    .select("id")
    .eq("patient_email", patientEmail)
    .is("confirmed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  expect(error, error?.message).toBeNull();
  expect(draft, `no draft for ${patientEmail}`).not.toBeNull();
  const token = newAppointmentLinkToken();
  const { error: updateError } = await admin
    .from("appointment_drafts")
    .update({ token_hash: hashAppointmentLinkToken(token) })
    .eq("id", (draft as { id: string }).id);
  expect(updateError, updateError?.message).toBeNull();
  return token;
}
