/** Shown on public profile / finder when custom specialty is not yet approved. */
export const PUBLIC_SPECIALTY_UNDER_REVIEW_LABEL = "Specialty under review";

/** Public-facing specialty label; never exposes unapproved custom text. */
export function getPublicSpecialtyDisplayLabel(input: {
  specialty?: string | null;
  is_specialty_approved?: boolean | null;
  fallback?: string;
}): string {
  if (input.is_specialty_approved === false) {
    return PUBLIC_SPECIALTY_UNDER_REVIEW_LABEL;
  }
  const raw = (input.specialty ?? "").trim();
  if (raw) return raw;
  return input.fallback ?? "General Practice";
}

/** Exclude unapproved custom specialties from specialty-based finder filters. */
export function matchesFinderSpecialtyFilter(input: {
  specialty?: string | null;
  specialties?: readonly string[] | null;
  is_specialty_approved?: boolean | null;
  activeSpecialty: string;
  matchesSpecialty: (rowSpecialty: string, filter: string) => boolean;
}): boolean {
  if (!input.activeSpecialty.trim()) return true;
  if (input.is_specialty_approved === false) return false;
  const labels =
    input.specialties && input.specialties.length > 0
      ? input.specialties
      : [input.specialty ?? ""];
  return labels.some((rowSpecialty) =>
    input.matchesSpecialty(rowSpecialty, input.activeSpecialty),
  );
}
