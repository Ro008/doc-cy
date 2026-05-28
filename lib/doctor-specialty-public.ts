/** Shown on public profile / finder when custom specialty is not yet approved. */
export const PUBLIC_SPECIALTY_UNDER_REVIEW_LABEL = "Specialty under review";

export function isSpecialtyResolvedForVerification(doctor: {
  is_specialty_approved?: boolean | null;
  specialty_requires_standard_at?: string | null;
}): boolean {
  if (doctor.specialty_requires_standard_at) return false;
  return doctor.is_specialty_approved !== false;
}

export function verificationBlockedReason(doctor: {
  is_specialty_approved?: boolean | null;
  specialty_requires_standard_at?: string | null;
}): string | null {
  if (isSpecialtyResolvedForVerification(doctor)) return null;
  if (doctor.specialty_requires_standard_at) {
    return "Resolve specialty first: the professional must choose a standard category (or map/approve in Pending specialties).";
  }
  return "Resolve specialty first in Pending specialties (map, approve, or require standard category).";
}

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
  is_specialty_approved?: boolean | null;
  activeSpecialty: string;
  matchesSpecialty: (rowSpecialty: string, filter: string) => boolean;
}): boolean {
  if (!input.activeSpecialty.trim()) return true;
  if (input.is_specialty_approved === false) return false;
  return input.matchesSpecialty(input.specialty ?? "", input.activeSpecialty);
}
