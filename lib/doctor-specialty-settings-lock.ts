/** API / UI copy when a doctor tries to change specialty from settings. */
export const SPECIALTY_CHANGE_REQUIRES_SUPPORT_MESSAGE =
  "Specialty cannot be changed in settings. Contact Support to request a specialty update.";

/**
 * True when the client sent a specialty that differs from the stored value.
 * Omitted / identical specialty is allowed (legacy clients may still send the current value).
 */
export function isSpecialtyChangeAttempt(
  currentSpecialty: string | null | undefined,
  requestedSpecialty: string | null | undefined,
): boolean {
  if (requestedSpecialty === undefined || requestedSpecialty === null) return false;
  return requestedSpecialty.trim() !== String(currentSpecialty ?? "").trim();
}
