import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";

/**
 * Pieces of the Visits tab's cards (user, 2026-10-12): the date tile, the patient's initials
 * and the month headings. Cyprus time throughout.
 */
export function visitDateParts(iso: string): { day: string; month: string; weekday: string; time: string } {
  const d = new Date(iso);
  return {
    day: formatInTimeZone(d, CY_TZ, "d"),
    month: formatInTimeZone(d, CY_TZ, "MMM").toUpperCase(),
    weekday: formatInTimeZone(d, CY_TZ, "EEE"),
    time: formatInTimeZone(d, CY_TZ, "HH:mm"),
  };
}

/** First letters of the first and last word, upper-cased; "?" when there is no name. */
export function patientInitials(name: string | null | undefined): string {
  const words = String(name ?? "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

export type MonthGroup<T> = { key: string; label: string; visits: T[] };

/** Consecutive visits under their month (newest first in, newest first out). */
export function groupVisitsByMonth<T extends { appointment_datetime: string }>(visits: T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const visit of visits) {
    const d = new Date(visit.appointment_datetime);
    const key = formatInTimeZone(d, CY_TZ, "yyyy-MM");
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.visits.push(visit);
    } else {
      groups.push({ key, label: formatInTimeZone(d, CY_TZ, "MMMM yyyy"), visits: [visit] });
    }
  }
  return groups;
}
