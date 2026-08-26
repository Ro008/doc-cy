import { validateSpecialtySubmission } from "@/lib/specialty-submission";
import { SPECIALTY_CHANGE_LICENSE_MAX } from "@/lib/doctor-specialty-change-request";

export const MAX_DOCTOR_SPECIALTIES = 5;

export type DoctorSpecialtyEntryInput = {
  specialty: string;
  fromMaster: boolean;
  licenseNumber: string;
};

export type DoctorSpecialtyEntryValidated = {
  specialty: string;
  fromMaster: boolean;
  isApproved: boolean;
  licenseNumber: string;
};

export type ValidateDoctorSpecialtyEntriesResult =
  | { ok: true; entries: DoctorSpecialtyEntryValidated[] }
  | { ok: false; message: string };

/**
 * Validates 1..MAX flat specialty+license rows for registration / add-specialty.
 * Duplicates (case-insensitive) are rejected.
 */
export function validateDoctorSpecialtyEntries(
  inputs: DoctorSpecialtyEntryInput[],
): ValidateDoctorSpecialtyEntriesResult {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, message: "Add at least one specialty." };
  }
  if (inputs.length > MAX_DOCTOR_SPECIALTIES) {
    return {
      ok: false,
      message: `You can add up to ${MAX_DOCTOR_SPECIALTIES} specialties.`,
    };
  }

  const seen = new Set<string>();
  const entries: DoctorSpecialtyEntryValidated[] = [];

  for (let i = 0; i < inputs.length; i += 1) {
    const row = inputs[i]!;
    const licenseNumber = String(row.licenseNumber ?? "").trim();
    if (!licenseNumber) {
      return {
        ok: false,
        message: `License / certification number is required for specialty ${i + 1}.`,
      };
    }
    if (licenseNumber.length > SPECIALTY_CHANGE_LICENSE_MAX) {
      return {
        ok: false,
        message: `License number for specialty ${i + 1} must be ${SPECIALTY_CHANGE_LICENSE_MAX} characters or fewer.`,
      };
    }

    const spec = validateSpecialtySubmission(row.specialty, row.fromMaster);
    if (spec.ok === false) {
      return {
        ok: false,
        message:
          inputs.length > 1
            ? `Specialty ${i + 1}: ${spec.message}`
            : spec.message,
      };
    }

    const key = spec.specialty.toLowerCase();
    if (seen.has(key)) {
      return {
        ok: false,
        message: `Duplicate specialty: ${spec.specialty}.`,
      };
    }
    seen.add(key);
    entries.push({
      specialty: spec.specialty,
      fromMaster: row.fromMaster,
      isApproved: spec.is_specialty_approved,
      licenseNumber,
    });
  }

  return { ok: true, entries };
}

/** Public-facing specialty labels (approved only); falls back to single specialty. */
export function publicSpecialtyLabels(input: {
  specialties?: string[] | null;
  specialty?: string | null;
  is_specialty_approved?: boolean | null;
}): string[] {
  if (input.is_specialty_approved === false) {
    return [];
  }
  const fromArray = (input.specialties ?? [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);
  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }
  const single = String(input.specialty ?? "").trim();
  return single ? [single] : [];
}

/** SEO / meta subtitle: equal-weight join, no primary. */
export function formatSpecialtiesForSeo(labels: readonly string[]): string {
  return labels.map((s) => s.trim()).filter(Boolean).join(" · ");
}
