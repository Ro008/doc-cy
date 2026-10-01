/**
 * What a professional can remove from their profile in settings (user, 2026-09-30):
 * any clinic and any specialty, as long as one of each is left. Removing the primary
 * clinic promotes the next one.
 */

export const LAST_CLINIC_MESSAGE = "Your profile needs at least one clinic.";
export const LAST_SPECIALTY_MESSAGE = "Your profile needs at least one specialty.";

export type RemovalCheck<Ok extends object = object> =
  | ({ ok: true } & Ok)
  | { ok: false; reason: "last" | "not-found"; message: string };

type ClinicLike = { id: string; isPrimary: boolean };

export function canRemoveClinic(clinics: readonly ClinicLike[], id: string): RemovalCheck {
  if (!clinics.some((clinic) => clinic.id === id)) {
    return { ok: false, reason: "not-found", message: "That clinic is not on your profile." };
  }
  if (clinics.length < 2) {
    return { ok: false, reason: "last", message: LAST_CLINIC_MESSAGE };
  }
  return { ok: true };
}

export function clinicsAfterRemoval<T extends ClinicLike>(clinics: readonly T[], id: string): T[] {
  if (!canRemoveClinic(clinics, id).ok) return [...clinics];
  const removedPrimary = clinics.find((clinic) => clinic.id === id)?.isPrimary ?? false;
  const remaining = clinics.filter((clinic) => clinic.id !== id);
  if (!removedPrimary || remaining.some((clinic) => clinic.isPrimary)) return remaining;
  return remaining.map((clinic, index) => (index === 0 ? { ...clinic, isPrimary: true } : clinic));
}

export function canRemoveSpecialty(
  specialties: readonly string[],
  label: string,
): RemovalCheck<{ specialty: string }> {
  const current = specialties.map((s) => s.trim()).filter(Boolean);
  const wanted = label.trim().toLowerCase();
  const match = current.find((s) => s.toLowerCase() === wanted);
  if (!match) {
    return { ok: false, reason: "not-found", message: "That specialty is not on your profile." };
  }
  if (current.length < 2) {
    return { ok: false, reason: "last", message: LAST_SPECIALTY_MESSAGE };
  }
  return { ok: true, specialty: match };
}
