/** Public-facing specialty label. */
export function getPublicSpecialtyDisplayLabel(input: {
  specialty?: string | null;
  fallback?: string;
}): string {
  const raw = (input.specialty ?? "").trim();
  if (raw) return raw;
  return input.fallback ?? "General Practice";
}

/** Whether a card's specialties match the active specialty filter. */
export function matchesFinderSpecialtyFilter(input: {
  specialty?: string | null;
  specialties?: readonly string[] | null;
  activeSpecialty: string;
  matchesSpecialty: (rowSpecialty: string, filter: string) => boolean;
}): boolean {
  if (!input.activeSpecialty.trim()) return true;
  const labels =
    input.specialties && input.specialties.length > 0
      ? input.specialties
      : [input.specialty ?? ""];
  return labels.some((rowSpecialty) =>
    input.matchesSpecialty(rowSpecialty, input.activeSpecialty),
  );
}
