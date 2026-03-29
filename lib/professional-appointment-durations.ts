/** Allowed visit lengths on the professional review screen (minutes). Below 60: 15-min steps; from 60 onward: 30-min steps. */
export const PROFESSIONAL_DURATION_OPTIONS = [
  15, 30, 45, 60, 90, 120, 150, 180,
] as const;

export type ProfessionalDurationOption = (typeof PROFESSIONAL_DURATION_OPTIONS)[number];

export function isAllowedProfessionalDuration(m: number): m is ProfessionalDurationOption {
  return (PROFESSIONAL_DURATION_OPTIONS as readonly number[]).includes(m);
}

/** Label for duration toggle buttons: minutes under 1h, "1h" at 60, then "1h 30min", "2h", etc. */
export function formatProfessionalDurationLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  if (minutes === 60) {
    return "1h";
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}
