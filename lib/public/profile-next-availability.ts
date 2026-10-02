import type { PublicAvailabilityDay } from "@/lib/public/compute-public-booking-slots";

/** Day cards in the profile hero ("Today from 14:00", "Mon 5 Oct from 11:00"…). */
export const PROFILE_NEXT_AVAILABILITY_DAY_LIMIT = 6;

export type ProfileAvailabilityDay = {
  dateKey: string;
  /** First free slot that day (`YYYY-MM-DDTHH:mm`). */
  slotKey: string;
  fromTime: string;
  slotCount: number;
  isToday: boolean;
  weekdayLabel: string;
  dateLabel: string;
};

export function summarizeNextAvailabilityDays(
  days: readonly PublicAvailabilityDay[],
  limit = PROFILE_NEXT_AVAILABILITY_DAY_LIMIT,
): ProfileAvailabilityDay[] {
  if (limit <= 0) return [];
  const summary: ProfileAvailabilityDay[] = [];
  for (const day of days) {
    const first = day.slots[0];
    if (!first) continue;
    summary.push({
      dateKey: day.dateKey,
      slotKey: first.slotKey,
      fromTime: first.timeLabel,
      slotCount: day.slots.length,
      isToday: day.isToday,
      weekdayLabel: day.weekdayLabel,
      dateLabel: day.dateLabel,
    });
    if (summary.length >= limit) break;
  }
  return summary;
}

/** Drives the one "live" dot: only true when today still has a free time. */
export function hasAvailabilityToday(summary: readonly ProfileAvailabilityDay[]): boolean {
  return summary.some((day) => day.isToday);
}
