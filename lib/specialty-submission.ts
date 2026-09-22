import {
  type SpecialtyCatalogueNames,
  matchCatalogueSpecialty,
} from "@/lib/specialty-options";

export type SpecialtySaveResult =
  | { ok: true; specialty: string; is_specialty_approved: boolean }
  | { ok: false; message: string };

/**
 * Validates specialty from client: catalogue pick vs custom "Other" text.
 * A pick is stored under its catalogue name; custom text that matches a catalogue
 * name (directly or through a legacy spelling) must be picked from the list instead.
 */
export function validateSpecialtySubmission(
  specialty: string,
  fromMaster: boolean,
  catalogue: SpecialtyCatalogueNames,
): SpecialtySaveResult {
  const s = specialty.trim();
  if (!s) {
    return { ok: false, message: "Specialty is required." };
  }
  const match = matchCatalogueSpecialty(catalogue, s);
  if (fromMaster) {
    if (!match || match.viaAlias) {
      return { ok: false, message: "Please choose a specialty from the list." };
    }
    return { ok: true, specialty: match.name, is_specialty_approved: true };
  }
  if (s.length > 120) {
    return { ok: false, message: "Custom specialty must be 120 characters or less." };
  }
  if (match) {
    return {
      ok: false,
      message: "This matches a standard specialty — select it from the list instead of Other.",
    };
  }
  return { ok: true, specialty: s, is_specialty_approved: false };
}

export function parseSpecialtyFromMasterField(raw: FormDataEntryValue | null): boolean {
  const v = typeof raw === "string" ? raw.trim() : "";
  return v === "1" || v === "true" || v === "on";
}

export function normalizeApprovedCustomSpecialty(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
