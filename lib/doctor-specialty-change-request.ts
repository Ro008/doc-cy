import { validateSpecialtySubmission } from "@/lib/specialty-submission";

export const SPECIALTY_CHANGE_LICENSE_MAX = 80;
export const SPECIALTY_CHANGE_FOUNDER_NOTE_MAX = 500;

export type SpecialtyChangeRequestInput = {
  toSpecialty: string;
  toSpecialtyFromMaster: boolean;
  licenseNumber: string;
};

export type SpecialtyChangeRequestValidation =
  | {
      ok: true;
      toSpecialty: string;
      toSpecialtyFromMaster: boolean;
      isSpecialtyApproved: boolean;
      licenseNumber: string;
    }
  | { ok: false; message: string };

export function validateSpecialtyChangeRequestInput(
  input: SpecialtyChangeRequestInput,
): SpecialtyChangeRequestValidation {
  const licenseNumber = String(input.licenseNumber ?? "").trim();
  if (!licenseNumber) {
    return { ok: false, message: "License / certification number is required." };
  }
  if (licenseNumber.length > SPECIALTY_CHANGE_LICENSE_MAX) {
    return {
      ok: false,
      message: `License number must be ${SPECIALTY_CHANGE_LICENSE_MAX} characters or fewer.`,
    };
  }

  const spec = validateSpecialtySubmission(
    input.toSpecialty,
    input.toSpecialtyFromMaster,
  );
  if (spec.ok === false) {
    return { ok: false, message: spec.message };
  }

  return {
    ok: true,
    toSpecialty: spec.specialty,
    toSpecialtyFromMaster: input.toSpecialtyFromMaster,
    isSpecialtyApproved: spec.is_specialty_approved,
    licenseNumber,
  };
}

export function normalizeFounderNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, SPECIALTY_CHANGE_FOUNDER_NOTE_MAX);
}
