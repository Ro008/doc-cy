import type { SupabaseClient } from "@supabase/supabase-js";

import { isDirectoryCanaryClinicId } from "@/lib/directory-canaries";
import { MAX_DOCTOR_LOCATIONS } from "@/lib/doctor-locations";
import type { HttpResult } from "@/lib/profile-change-requests-server";
import { LAST_CLINIC_MESSAGE } from "@/lib/settings-removal-rules";

/**
 * Settings → Clinics (user, 2026-10-11): she joins a clinic DocCy already has, and
 * leaves one, at once. No founder; each database function makes the change and its
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
  if (error) {
    if (error.code === "23514") return { ok: false, status: 409, message: LAST_CLINIC_MESSAGE };
    if (error.code === "P0002" || error.code === "22P02") return { ok: false, status: 404, message: NOT_HERS };
    console.error("[DocCy] clinic leave", error);
    return { ok: false, status: 500, message: "Could not leave the clinic. Please try again." };
  }
  return { ok: true };
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
