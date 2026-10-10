import type { SupabaseClient } from "@supabase/supabase-js";

import type { HttpResult } from "@/lib/profile-change-requests-server";
import {
  MAX_QUALIFICATIONS,
  parsePatientAges,
  parseSavedQualifications,
  type PatientAges,
  type Qualification,
  type SavedQualification,
} from "@/lib/settings-profile-details";

/**
 * Settings → Profile details that change as she pleases (user, 2026-10-10): "Patients
 * I see", "How you help patients" (bio), languages and qualifications. No founder; each
 * database function makes the change and its request_log row together.
 */

const SAVE_FAILED = "Could not save. Please try again.";

/** What Settings shows for "Patients I see" and Qualifications. */
export async function loadProfileDetails(
  service: SupabaseClient,
  professionalId: string,
): Promise<{ patientAges: PatientAges | null; qualifications: SavedQualification[] }> {
  const { data, error } = await service
    .from("professionals")
    .select("patients_seen, qualifications")
    .eq("id", professionalId)
    .maybeSingle();
  // A database without the columns yet: the cards open empty.
  if (error) console.error("[DocCy] profile details", error);
  return {
    patientAges: parsePatientAges(data?.patients_seen),
    qualifications: parseSavedQualifications(data?.qualifications),
  };
}

/** "Patients I see": adults, children or all (professional_patients_seen_set). */
export async function setProfessionalPatientAges(
  service: SupabaseClient,
  input: { professionalId: string; patientAges: PatientAges },
): Promise<HttpResult<{ changed: boolean }>> {
  const { data: requestId, error } = await service.rpc("professional_patients_seen_set", {
    p_professional_id: input.professionalId,
    p_patients_seen: input.patientAges,
  });
  if (error) {
    console.error("[DocCy] patients seen change", error);
    return { ok: false, status: 500, message: SAVE_FAILED };
  }
  return { ok: true, changed: Boolean(requestId) };
}

/** "How you help patients" (professional_bio_set): empty means no bio. */
export async function setProfessionalBio(
  service: SupabaseClient,
  input: { professionalId: string; bio: string },
): Promise<HttpResult<{ changed: boolean }>> {
  const { data: requestId, error } = await service.rpc("professional_bio_set", {
    p_professional_id: input.professionalId,
    p_bio: input.bio,
  });
  if (error) {
    console.error("[DocCy] bio change", error);
    return { ok: false, status: 500, message: SAVE_FAILED };
  }
  return { ok: true, changed: Boolean(requestId) };
}

/** Her languages, already checked against the list (professional_languages_set). */
export async function setProfessionalLanguages(
  service: SupabaseClient,
  input: { professionalId: string; languages: string[] },
): Promise<HttpResult<{ changed: boolean }>> {
  const { data: requestId, error } = await service.rpc("professional_languages_set", {
    p_professional_id: input.professionalId,
    p_languages: input.languages,
  });
  if (error) {
    console.error("[DocCy] languages change", error);
    return { ok: false, status: 500, message: SAVE_FAILED };
  }
  return { ok: true, changed: Boolean(requestId) };
}

/** Adds one qualification, at most 6 (professional_qualification_add). */
export async function addProfessionalQualification(
  service: SupabaseClient,
  input: { professionalId: string; qualification: Qualification },
): Promise<HttpResult<{ qualification: SavedQualification }>> {
  const { data, error } = await service.rpc("professional_qualification_add", {
    p_professional_id: input.professionalId,
    p_title: input.qualification.title,
    p_institution: input.qualification.institution,
    p_year: input.qualification.year,
  });
  if (error) {
    if (error.code === "23514") {
      return {
        ok: false,
        status: 409,
        message: `You can list up to ${MAX_QUALIFICATIONS} qualifications. Remove one to add another.`,
      };
    }
    console.error("[DocCy] qualification add", error);
    return { ok: false, status: 500, message: "Could not add the qualification. Please try again." };
  }
  const [qualification] = parseSavedQualifications([(data as { qualification?: unknown } | null)?.qualification]);
  if (!qualification) {
    console.error("[DocCy] qualification add: unexpected result", data);
    return { ok: false, status: 500, message: "Could not add the qualification. Please try again." };
  }
  return { ok: true, qualification };
}

/** Removes one of her qualifications by its id (professional_qualification_remove). */
export async function removeProfessionalQualification(
  service: SupabaseClient,
  input: { professionalId: string; qualificationId: string },
): Promise<HttpResult<object>> {
  const { error } = await service.rpc("professional_qualification_remove", {
    p_professional_id: input.professionalId,
    p_qualification_id: input.qualificationId,
  });
  if (error) {
    // Not hers, or not an id at all (22P02): nothing to remove.
    if (error.code === "P0002" || error.code === "22P02") {
      return { ok: false, status: 404, message: "That qualification is not on your profile." };
    }
    console.error("[DocCy] qualification remove", error);
    return { ok: false, status: 500, message: "Could not remove the qualification. Please try again." };
  }
  return { ok: true };
}
