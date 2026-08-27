import { validateSpecialtySubmission } from "@/lib/specialty-submission";
import { isMasterSpecialty } from "@/lib/cyprus-specialties";

export const SPECIALTY_CHANGE_LICENSE_MAX = 80;
export const SPECIALTY_CHANGE_FOUNDER_NOTE_MAX = 500;

export type SpecialtyChangeRequestKind = "add" | "replace" | "remove";

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
  if (v === "add" || v === "replace" || v === "remove") return v;
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
 * Validates add / replace / remove against the doctor's current specialty labels.
 * For remove: fromSpecialty is required and doctor must keep at least one specialty.
 */
export function validateSpecialtyChangeAgainstProfile(input: {
  kind: SpecialtyChangeRequestKind;
  fromSpecialty?: string | null;
  toSpecialty?: string | null;
  existingLabels: readonly string[];
}): { ok: true; fromSpecialty: string | null } | { ok: false; message: string } {
  const existing = input.existingLabels.map((s) => s.trim()).filter(Boolean);
  const to = String(input.toSpecialty ?? "").trim();
  const toLower = to.toLowerCase();

  if (input.kind === "add") {
    if (!to) {
      return { ok: false, message: "Choose the specialty you want to add." };
    }
    if (existing.some((s) => s.toLowerCase() === toLower)) {
      return {
        ok: false,
        message: "You already have this specialty on your profile.",
      };
    }
    return { ok: true, fromSpecialty: null };
  }

  if (input.kind === "remove") {
    if (existing.length < 2) {
      return {
        ok: false,
        message:
          "You need at least two specialties before you can remove one. Request a change instead.",
      };
    }
    const from = String(input.fromSpecialty ?? "").trim();
    if (!from) {
      return { ok: false, message: "Choose which specialty you want to remove." };
    }
    if (!existing.some((s) => s.toLowerCase() === from.toLowerCase())) {
      return {
        ok: false,
        message: "That specialty is not on your profile.",
      };
    }
    const canonicalFrom =
      existing.find((s) => s.toLowerCase() === from.toLowerCase()) ?? from;
    return { ok: true, fromSpecialty: canonicalFrom };
  }

  // replace
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
  if (!to) {
    return { ok: false, message: "Choose the new specialty." };
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

/**
 * Builds the approve payload for the founder specialty-change review API.
 * Remove requests must not require toSpecialty / license (that was a regression).
 */
export function buildSpecialtyChangeApproveReviewBody(input: {
  requestId: string;
  requestKind: SpecialtyChangeRequestKind;
  fromSpecialty: string;
  toSpecialty: string;
  licenseNumber: string;
  /** When editing before approve, overrides the stored toSpecialty / license. */
  editedSpecialty?: string | null;
  editedLicense?: string | null;
}):
  | {
      ok: true;
      body: {
        requestId: string;
        action: "approve";
        toSpecialty?: string;
        toSpecialtyFromMaster?: boolean;
        licenseNumber?: string;
      };
    }
  | { ok: false; message: string } {
  const requestId = String(input.requestId ?? "").trim();
  if (!requestId) {
    return { ok: false, message: "Request id is required." };
  }

  if (input.requestKind === "remove") {
    if (!String(input.fromSpecialty ?? "").trim()) {
      return {
        ok: false,
        message: "Remove request is missing the specialty to delete.",
      };
    }
    return {
      ok: true,
      body: { requestId, action: "approve" },
    };
  }

  const specialty = String(
    input.editedSpecialty != null ? input.editedSpecialty : input.toSpecialty,
  ).trim();
  const license = String(
    input.editedLicense != null ? input.editedLicense : input.licenseNumber,
  ).trim();

  if (!specialty) {
    return { ok: false, message: "Specialty is required." };
  }
  if (!license) {
    return { ok: false, message: "License number is required." };
  }

  return {
    ok: true,
    body: {
      requestId,
      action: "approve",
      toSpecialty: specialty,
      toSpecialtyFromMaster: isMasterSpecialty(specialty),
      licenseNumber: license,
    },
  };
}
