import { tooOftenRefusal } from "@/lib/request-frequency";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isDirectoryCanaryClinicId } from "@/lib/directory-canaries";
import { MAX_DOCTOR_LOCATIONS } from "@/lib/doctor-locations";
import type { HttpResult } from "@/lib/profile-change-requests-server";
import { LAST_CLINIC_MESSAGE } from "@/lib/settings-removal-rules";

/**
 * Settings → Clinics (user, 2026-10-11): she joins a clinic DocCy already has, and
 * leaves one, at once; her hours, booking limits and online-booking switch at a clinic
 * save at once too. No founder; each database function makes the change and its
 * request_log row together, and keeps the rules (at most 5 clinics, never the last).
 */

const CLINIC_NOT_FOUND = "That clinic is not in DocCy.";
const NOT_HERS = "That clinic is not on your profile.";

/** Joins a clinic DocCy has (professional_clinic_join); answers with her link to it. */
export async function joinProfessionalClinic(
  service: SupabaseClient,
  input: { professionalId: string; clinicId: string },
): Promise<HttpResult<{ linkId: string }>> {
  const failed = { ok: false as const, status: 500, message: "Could not add the clinic. Please try again." };
  const clinicId = input.clinicId.trim();
  // Canary clinics are bait for scrapers: never a place to work at.
  if (!clinicId || isDirectoryCanaryClinicId(clinicId)) {
    return { ok: false, status: 404, message: CLINIC_NOT_FOUND };
  }
  const { data, error } = await service.rpc("professional_clinic_join", {
    p_professional_id: input.professionalId,
    p_clinic_id: clinicId,
  });
  // Changed too often (request_types limits): she is told when it opens again.
  const tooOften = tooOftenRefusal(error);
  if (tooOften) return { ok: false, ...tooOften };
  if (error) {
    if (error.code === "23505") return { ok: false, status: 409, message: "You already work at this clinic." };
    if (error.code === "23514") {
      return {
        ok: false,
        status: 409,
        message: `You can have up to ${MAX_DOCTOR_LOCATIONS} clinics. Leave one to add another.`,
      };
    }
    // Unknown or archived, or not an id at all (22P02).
    if (error.code === "P0002" || error.code === "22P02") {
      return { ok: false, status: 404, message: CLINIC_NOT_FOUND };
    }
    console.error("[DocCy] clinic join", error);
    return failed;
  }
  const linkId = String((data as { link_id?: unknown } | null)?.link_id ?? "").trim();
  if (!linkId) {
    console.error("[DocCy] clinic join: unexpected result", data);
    return failed;
  }
  return { ok: true, linkId };
}

/** Leaves one of her clinics, by her link to it (professional_clinic_leave). */
export async function leaveProfessionalClinic(
  service: SupabaseClient,
  input: { professionalId: string; linkId: string },
): Promise<HttpResult<object>> {
  const { error } = await service.rpc("professional_clinic_leave", {
    p_professional_id: input.professionalId,
    p_link_id: input.linkId,
  });
  // Changed too often (request_types limits): she is told when it opens again.
  const tooOften = tooOftenRefusal(error);
  if (tooOften) return { ok: false, ...tooOften };
  if (error) {
    if (error.code === "23514") return { ok: false, status: 409, message: LAST_CLINIC_MESSAGE };
    if (error.code === "P0002" || error.code === "22P02") return { ok: false, status: 404, message: NOT_HERS };
    console.error("[DocCy] clinic leave", error);
    return { ok: false, status: 500, message: "Could not leave the clinic. Please try again." };
  }
  return { ok: true };
}

const HOURS_COLUMNS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "start_time",
  "end_time",
  "weekly_schedule",
  "break_start",
  "break_end",
  "slot_duration_minutes",
] as const;

export type ClinicLimitsInput = {
  bookingHorizonDays?: number;
  minimumNoticeHours?: number;
  patientCancelNoticeHours?: number;
};

type Saved = HttpResult<{ changed: boolean }>;

function clinicSaveError(error: { code?: string }, what: string, refused: string): Saved {
  // Changed too often (request_types limits): she is told when it opens again.
  const tooOften = tooOftenRefusal(error);
  if (tooOften) return { ok: false, ...tooOften };
  if (error.code === "P0002" || error.code === "22P02") return { ok: false, status: 404, message: NOT_HERS };
  if (error.code === "22023" || error.code === "23514") return { ok: false, status: 400, message: refused };
  console.error(`[DocCy] clinic ${what}`, error);
  return { ok: false, status: 500, message: "Could not save. Please try again." };
}

/**
 * Her hours at one clinic: open days, hours, breaks and slot length
 * (professional_clinic_hours_set). Saved and recorded together; `changed` is false
 * when she saved what was already there, which records nothing.
 */
export async function saveClinicHours(
  service: SupabaseClient,
  input: { professionalId: string; linkId: string; hours: Record<string, unknown> },
): Promise<Saved> {
  const hours: Record<string, unknown> = {};
  for (const column of HOURS_COLUMNS) {
    if (input.hours[column] !== undefined) hours[column] = input.hours[column];
  }
  const { data, error } = await service.rpc("professional_clinic_hours_set", {
    p_professional_id: input.professionalId,
    p_link_id: input.linkId,
    p_hours: hours,
  });
  if (error) return clinicSaveError(error, "hours", "Those hours could not be saved. Check them and try again.");
  return { ok: true, changed: Boolean(data) };
}

/** The booking limits of one clinic (professional_clinic_limits_set); a limit left out is kept. */
export async function saveClinicLimits(
  service: SupabaseClient,
  input: { professionalId: string; linkId: string; limits: ClinicLimitsInput },
): Promise<Saved> {
  const { data, error } = await service.rpc("professional_clinic_limits_set", {
    p_professional_id: input.professionalId,
    p_link_id: input.linkId,
    p_booking_horizon_days: input.limits.bookingHorizonDays ?? null,
    p_minimum_notice_hours: input.limits.minimumNoticeHours ?? null,
    p_patient_cancel_notice_hours: input.limits.patientCancelNoticeHours ?? null,
  });
  if (error) return clinicSaveError(error, "limits", "Choose one of the listed booking limits.");
  return { ok: true, changed: Boolean(data) };
}

/** The online-booking switch of one clinic (professional_clinic_online_booking_set). */
export async function setClinicOnlineBooking(
  service: SupabaseClient,
  input: { professionalId: string; linkId: string; online: boolean },
): Promise<Saved> {
  const { data, error } = await service.rpc("professional_clinic_online_booking_set", {
    p_professional_id: input.professionalId,
    p_link_id: input.linkId,
    p_online_booking: input.online,
  });
  if (error) return clinicSaveError(error, "online booking", "Could not save. Please try again.");
  return { ok: true, changed: Boolean(data) };
}

/**
 * What is still coming at one of her clinics, for the Leave dialog: confirmed visits
 * (they stay) and requests waiting for an answer. Null when the clinic is not hers.
 */
export async function loadClinicUpcomingCounts(
  service: SupabaseClient,
  input: { professionalId: string; linkId: string },
): Promise<{ confirmed: number; open: number } | null> {
  const { data: link } = await service
    .from("professional_clinics")
    .select("clinic_id")
    .eq("id", input.linkId)
    .eq("professional_id", input.professionalId)
    .maybeSingle();
  const clinicId = String((link as { clinic_id?: unknown } | null)?.clinic_id ?? "").trim();
  if (!clinicId) return null;

  const upcoming = (statuses: string[]) =>
    service
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", input.professionalId)
      .eq("clinic_id", clinicId)
      .in("status", statuses)
      .gt("appointment_datetime", new Date().toISOString());
  const [confirmed, open] = await Promise.all([upcoming(["CONFIRMED"]), upcoming(["REQUESTED", "NEEDS_RESCHEDULE"])]);
  if (confirmed.error || open.error) {
    console.error("[DocCy] clinic upcoming counts", confirmed.error ?? open.error);
    return { confirmed: 0, open: 0 };
  }
  return { confirmed: confirmed.count ?? 0, open: open.count ?? 0 };
}
