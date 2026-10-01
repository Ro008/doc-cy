import {
  SPECIALTY_CHANGE_LICENSE_MAX,
  type SpecialtyChangeRequestKind,
} from "@/lib/doctor-specialty-change-request";
import { validateSpecialtySubmission } from "@/lib/specialty-submission";
import type { SpecialtyCatalogueNames } from "@/lib/specialty-options";

/**
 * Settings asks for one thing only: add a specialty (user, 2026-10-01). Removing is
 * instant with the chip's ✕, so changing one is "add the new one, remove the old one
 * once it is approved"; the one-specialty minimum still holds that way. Older pending
 * "replace" / "remove" requests are still shown until DocCy reviews them.
 * API: POST /api/doctor-specialty-change-request (unchanged, requestKind "add").
 */

export const SPECIALTY_LICENSE_HELP = "So DocCy can check you're registered for this specialty.";

export type AddSpecialtyForm = { specialty: string; fromMaster: boolean; license: string };

export type AddSpecialtyRequest = {
  requestKind: "add";
  fromSpecialty: null;
  toSpecialty: string;
  toSpecialtyFromMaster: boolean;
  licenseNumber: string;
};

export type AddSpecialtyErrors = { specialty?: string; license?: string };

export type AddSpecialtyValidation =
  | { ok: true; request: AddSpecialtyRequest }
  | { ok: false; errors: AddSpecialtyErrors };

function specialtyError(
  form: AddSpecialtyForm,
  catalogue: SpecialtyCatalogueNames,
  existing: readonly string[],
): { error: string } | { specialty: string } {
  const typed = form.specialty.trim();
  if (!typed) {
    return { error: form.fromMaster ? "Choose the specialty you want to add." : "Describe your specialty." };
  }
  if (existing.some((label) => label.trim().toLowerCase() === typed.toLowerCase())) {
    return { error: "You already have this specialty on your profile." };
  }
  const checked = validateSpecialtySubmission(typed, form.fromMaster, catalogue);
  if (checked.ok === false) return { error: checked.message };
  return { specialty: checked.specialty };
}

export function validateAddSpecialtyRequest(
  form: AddSpecialtyForm,
  catalogue: SpecialtyCatalogueNames,
  existing: readonly string[],
): AddSpecialtyValidation {
  const errors: AddSpecialtyErrors = {};

  const specialty = specialtyError(form, catalogue, existing);
  if ("error" in specialty) errors.specialty = specialty.error;

  const license = form.license.trim();
  if (!license) errors.license = "Enter your license or certification number.";
  else if (license.length > SPECIALTY_CHANGE_LICENSE_MAX) {
    errors.license = `Keep the license number under ${SPECIALTY_CHANGE_LICENSE_MAX} characters.`;
  }

  if ("error" in specialty || errors.license) return { ok: false, errors };
  return {
    ok: true,
    request: {
      requestKind: "add",
      fromSpecialty: null,
      toSpecialty: specialty.specialty,
      toSpecialtyFromMaster: form.fromMaster,
      licenseNumber: license,
    },
  };
}

/** The pending request, shown as a chip next to the profile's specialties. */
export function pendingSpecialtyChip(pending: {
  requestKind: SpecialtyChangeRequestKind;
  fromSpecialty: string | null;
  toSpecialty: string | null;
}): { label: string; status: string } {
  const from = String(pending.fromSpecialty ?? "").trim();
  const to = String(pending.toSpecialty ?? "").trim();
  if (pending.requestKind === "remove") return { label: from, status: "Removal in review" };
  if (pending.requestKind === "replace" && from) {
    return { label: to, status: `In review · replaces ${from}` };
  }
  return { label: to, status: "In review" };
}
