import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BOOKING_CONFIRM_LINK_MINUTES,
  hashAppointmentLinkToken,
  newAppointmentLinkToken,
} from "@/lib/appointment-link-token";
import type { BookingPatientFields } from "@/lib/booking-patient-fields";

/**
 * Online booking requests wait in `appointment_drafts` until the patient clicks the
 * emailed link (30 min, single use). A draft holds no time; the confirm step re-checks
 * the slot and only then creates the REQUESTED appointment (user, 2026-10-02).
 */

export const BOOKING_LIMITS = {
  draftsPerEmailPerHour: 5,
  draftsPerPhonePerHour: 5,
} as const;

export type BookingLimitRefusal = { code: "too_many_requests" | "open_request_exists"; message: string };

export function bookingLimitRefusal(counts: {
  draftsLastHourForEmail: number;
  draftsLastHourForPhone: number;
  openRequestsWithProfessional: number;
}): BookingLimitRefusal | null {
  if (counts.openRequestsWithProfessional > 0) {
    return {
      code: "open_request_exists",
      message:
        "You already have a request waiting with this professional. Please wait for their reply before sending another.",
    };
  }
  if (
    counts.draftsLastHourForEmail >= BOOKING_LIMITS.draftsPerEmailPerHour ||
    counts.draftsLastHourForPhone >= BOOKING_LIMITS.draftsPerPhonePerHour
  ) {
    return { code: "too_many_requests", message: "Too many booking attempts. Please try again later." };
  }
  return null;
}

export type DraftLinkState = "usable" | "used" | "replaced" | "expired" | "invalid";

/**
 * `replaced`: the patient sent the form again for the same professional, so only the
 * newest link works (user, 2026-10-05). An unconfirmed draft never blocks the form,
 * since nobody has proved the email yet.
 */
export function draftLinkState(
  draft: { expires_at: string; confirmed_at: string | null } | null | undefined,
  now: Date = new Date(),
  opts: { newerDraftExists?: boolean } = {},
): DraftLinkState {
  if (!draft) return "invalid";
  if (draft.confirmed_at) return "used";
  if (opts.newerDraftExists) return "replaced";
  return new Date(draft.expires_at).getTime() > now.getTime() ? "usable" : "expired";
}

/** For `.ilike(col, value)` as a case-insensitive exact match. */
export function escapeIlikeExact(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Open requests this email already has with this professional (waiting for her or for the patient). */
export async function countOpenRequestsWithProfessional(
  supabase: SupabaseClient,
  professionalId: string,
  patientEmail: string,
  now: Date = new Date(),
): Promise<number> {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", professionalId)
    .ilike("patient_email", escapeIlikeExact(patientEmail))
    .in("status", ["REQUESTED", "NEEDS_RESCHEDULE"])
    .gt("appointment_datetime", now.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function countRecentDrafts(
  supabase: SupabaseClient,
  by: { patientEmail: string } | { patientPhone: string },
  now: Date = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  let query = supabase
    .from("appointment_drafts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  query =
    "patientEmail" in by
      ? query.ilike("patient_email", escapeIlikeExact(by.patientEmail))
      : query.eq("patient_phone", by.patientPhone);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export type NewDraft = BookingPatientFields & {
  patientEmail: string;
  professionalId: string;
  clinicId: string;
  appointmentUtc: Date;
  durationMinutes: number;
  /** Optional, already checked to be hers; the database copies its name. */
  professionalServiceId?: string | null;
};

/** Saves the draft and returns the raw token for the email (only its hash is stored). */
export async function createAppointmentDraft(
  supabase: SupabaseClient,
  draft: NewDraft,
  now: Date = new Date(),
): Promise<{ token: string; draftId: string; expiresAt: Date }> {
  const token = newAppointmentLinkToken();
  const expiresAt = new Date(now.getTime() + BOOKING_CONFIRM_LINK_MINUTES * 60 * 1000);
  const { data, error } = await supabase
    .from("appointment_drafts")
    .insert({
      professional_id: draft.professionalId,
      clinic_id: draft.clinicId,
      appointment_datetime: draft.appointmentUtc.toISOString(),
      duration_minutes: draft.durationMinutes,
      patient_name: draft.patientName,
      patient_email: draft.patientEmail,
      patient_phone: draft.patientPhone,
      patient_gender: draft.patientGender,
      patient_birthdate: draft.patientBirthdate,
      is_new_patient: draft.isNewPatient,
      reason: draft.reason,
      professional_service_id: draft.professionalServiceId ?? null,
      token_hash: hashAppointmentLinkToken(token),
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("draft insert returned nothing");
  const draftId = String((data as { id: string }).id);

  // Only the newest link works: end this email's earlier unconfirmed drafts with her.
  // Confirming checks the expiry in the same UPDATE, so an ended link can't slip through.
  const { error: replaceError } = await supabase
    .from("appointment_drafts")
    .update({ expires_at: now.toISOString() })
    .eq("professional_id", draft.professionalId)
    .ilike("patient_email", escapeIlikeExact(draft.patientEmail))
    .is("confirmed_at", null)
    .gt("expires_at", now.toISOString())
    .neq("id", draftId);
  if (replaceError) throw replaceError;

  return { token, draftId, expiresAt };
}

/** Whether the patient sent the form again (same email, same professional) after this draft. */
async function hasNewerDraft(supabase: SupabaseClient, draft: AppointmentDraftRow): Promise<boolean> {
  const { count, error } = await supabase
    .from("appointment_drafts")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", draft.professional_id)
    .ilike("patient_email", escapeIlikeExact(draft.patient_email))
    .gt("created_at", draft.created_at);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** The link's state as the patient sees it, including `replaced`. */
export async function resolveDraftLinkState(
  supabase: SupabaseClient,
  draft: AppointmentDraftRow | null,
  now: Date = new Date(),
): Promise<DraftLinkState> {
  if (!draft || draft.confirmed_at) return draftLinkState(draft, now);
  return draftLinkState(draft, now, { newerDraftExists: await hasNewerDraft(supabase, draft) });
}

export const APPOINTMENT_DRAFT_SELECT =
  "id, professional_id, clinic_id, appointment_datetime, duration_minutes, patient_name, patient_email, patient_phone, patient_gender, patient_birthdate, is_new_patient, reason, professional_service_id, service_name, expires_at, confirmed_at, appointment_id, created_at";

export type AppointmentDraftRow = {
  id: string;
  professional_id: string;
  clinic_id: string;
  appointment_datetime: string;
  duration_minutes: number;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  patient_gender: string;
  patient_birthdate: string;
  is_new_patient: boolean;
  reason: string;
  professional_service_id: string | null;
  service_name: string | null;
  expires_at: string;
  confirmed_at: string | null;
  appointment_id: string | null;
  created_at: string;
};

export async function findDraftByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<AppointmentDraftRow | null> {
  const { data, error } = await supabase
    .from("appointment_drafts")
    .select(APPOINTMENT_DRAFT_SELECT)
    .eq("token_hash", hashAppointmentLinkToken(token))
    .maybeSingle();
  if (error) throw error;
  return (data as AppointmentDraftRow | null) ?? null;
}

/**
 * Uses the link once: marks the draft confirmed only if it is still unused and unexpired
 * (one guarded UPDATE, so two clicks can't both pass).
 */
export async function consumeDraftByToken(
  supabase: SupabaseClient,
  token: string,
  now: Date = new Date(),
): Promise<{ state: DraftLinkState; draft?: AppointmentDraftRow }> {
  const existing = await findDraftByToken(supabase, token);
  const state = await resolveDraftLinkState(supabase, existing, now);
  if (state !== "usable") return { state };

  const { data, error } = await supabase
    .from("appointment_drafts")
    .update({ confirmed_at: now.toISOString() })
    .eq("id", existing!.id)
    .is("confirmed_at", null)
    .gt("expires_at", now.toISOString())
    .select(APPOINTMENT_DRAFT_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { state: "used" };
  return { state: "usable", draft: data as AppointmentDraftRow };
}
