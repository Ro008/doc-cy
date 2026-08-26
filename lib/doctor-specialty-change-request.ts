import { validateSpecialtySubmission } from "@/lib/specialty-submission";

export const SPECIALTY_CHANGE_LICENSE_MAX = 80;
export const SPECIALTY_CHANGE_FOUNDER_NOTE_MAX = 500;

export type SpecialtyChangeRequestKind = "add" | "replace";

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

export function parseSpecialtyChangeRequestKind(
  raw: unknown,
): SpecialtyChangeRequestKind | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "add" || v === "replace") return v;
  return null;
}

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

/**
 * Validates add vs replace against the doctor's current specialty labels.
 */
export function validateSpecialtyChangeAgainstProfile(input: {
  kind: SpecialtyChangeRequestKind;
  fromSpecialty?: string | null;
  toSpecialty: string;
  existingLabels: readonly string[];
}): { ok: true; fromSpecialty: string | null } | { ok: false; message: string } {
  const existing = input.existingLabels.map((s) => s.trim()).filter(Boolean);
  const to = input.toSpecialty.trim();
  const toLower = to.toLowerCase();

  if (input.kind === "add") {
    if (existing.some((s) => s.toLowerCase() === toLower)) {
      return {
        ok: false,
        message: "You already have this specialty on your profile.",
      };
    }
    return { ok: true, fromSpecialty: null };
  }

  const from = String(input.fromSpecialty ?? "").trim();
  if (!from) {
    return { ok: false, message: "Choose which specialty you want to change." };
  }
  if (!existing.some((s) => s.toLowerCase() === from.toLowerCase())) {
    return {
      ok: false,
      message: "That specialty is not on your profile.",
    };
  }
  if (from.toLowerCase() === toLower) {
    return {
      ok: false,
      message: "Choose a different specialty than the one you want to replace.",
    };
  }
  if (
    existing.some(
      (s) =>
        s.toLowerCase() === toLower && s.toLowerCase() !== from.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      message: "You already have this specialty on your profile.",
    };
  }
  const canonicalFrom =
    existing.find((s) => s.toLowerCase() === from.toLowerCase()) ?? from;
  return { ok: true, fromSpecialty: canonicalFrom };
}

export function normalizeFounderNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, SPECIALTY_CHANGE_FOUNDER_NOTE_MAX);
}
