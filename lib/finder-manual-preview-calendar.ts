import { format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import type {
  FinderAvailabilityDayHeader,
  PublicAvailabilitySlot,
} from "@/lib/public/compute-public-booking-slots";
import { FINDER_AVAILABILITY_VISIBLE_DAY_COUNT } from "@/lib/public/compute-public-booking-slots";

export const MANUAL_PREVIEW_SLOTS_PER_DAY = 4;
/** At least this many fake slots land in the first visible week strip. */
export const MANUAL_PREVIEW_MIN_FIRST_WINDOW_SLOTS = 2;

export function manualPreviewSeedKey(manualId: string, locationKey: string | null): string {
  const extra = String(locationKey ?? "").trim();
  return extra ? `${manualId}:${extra}` : manualId;
}

export type ManualPreviewDay = FinderAvailabilityDayHeader & {
  slots: PublicAvailabilitySlot[];
};

const SLOT_TIME_POOL = [
  "08:30",
  "09:15",
  "10:00",
  "10:45",
  "11:30",
  "12:15",
  "14:00",
  "14:45",
  "15:30",
  "16:15",
  "17:00",
  "17:45",
] as const;

function seedFromString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUniqueIndices(
  count: number,
  candidates: readonly number[],
  rng: () => number,
): number[] {
  if (count <= 0 || candidates.length === 0) return [];
  const pool = [...candidates];
  const picked: number[] = [];
  while (picked.length < count && pool.length > 0) {
    const at = Math.floor(rng() * pool.length);
    picked.push(pool[at]!);
    pool.splice(at, 1);
  }
  return picked;
}

/** HH:mm string compare is safe for zero-padded 24h labels. */
export function isManualPreviewSlotInFuture(
  dateKey: string,
  timeLabel: string,
  now: Date = new Date(),
): boolean {
  const nowCyprus = utcToZonedTime(now, CY_TZ);
  const todayKey = format(nowCyprus, "yyyy-MM-dd");
  if (dateKey !== todayKey) return true;
  const nowCyprusTime = format(nowCyprus, "HH:mm");
  return timeLabel >= nowCyprusTime;
}

function futureTimesForDay(dateKey: string, now: Date): string[] {
  return SLOT_TIME_POOL.filter((timeLabel) =>
    isManualPreviewSlotInFuture(dateKey, timeLabel, now),
  );
}

/**
 * Stable decorative availability for disabled manual calendars (seeded per listing).
 * Sparse overall (~6–10 slots across 14 days), but always seeds enough slots into
 * the first visible week so the overlay still sits on a recognizable calendar.
 */
export function buildManualPreviewCalendar(
  dayHeaders: FinderAvailabilityDayHeader[],
  seedKey: string,
  now: Date = new Date(),
): ManualPreviewDay[] {
  if (dayHeaders.length === 0) return [];

  const rng = createSeededRng(seedFromString(seedKey));
  // 6, 8, or 10 — denser than before so week navigation rarely looks empty.
  const availableCount = 6 + Math.floor(rng() * 3) * 2;
  const firstWindowDays = Math.min(dayHeaders.length, FINDER_AVAILABILITY_VISIBLE_DAY_COUNT);

  const flatCandidatesForDayRange = (fromDay: number, toDayExclusive: number): number[] => {
    const out: number[] = [];
    for (let dayIndex = fromDay; dayIndex < toDayExclusive; dayIndex += 1) {
      const day = dayHeaders[dayIndex];
      if (!day || futureTimesForDay(day.dateKey, now).length === 0) continue;
      for (let slotIndex = 0; slotIndex < MANUAL_PREVIEW_SLOTS_PER_DAY; slotIndex += 1) {
        out.push(dayIndex * MANUAL_PREVIEW_SLOTS_PER_DAY + slotIndex);
      }
    }
    return out;
  };

  const firstWindowCandidates = flatCandidatesForDayRange(0, firstWindowDays);
  const restCandidates = flatCandidatesForDayRange(firstWindowDays, dayHeaders.length);

  const firstWindowTarget = Math.min(
    MANUAL_PREVIEW_MIN_FIRST_WINDOW_SLOTS,
    availableCount,
    firstWindowCandidates.length,
  );
  const firstWindowPicks = pickUniqueIndices(firstWindowTarget, firstWindowCandidates, rng);
  const remaining = Math.max(0, availableCount - firstWindowPicks.length);
  // Prefer later days for the rest; if the range is short, fill from leftover first-window cells.
  const leftoverFirst = firstWindowCandidates.filter((i) => !firstWindowPicks.includes(i));
  const restPicks = pickUniqueIndices(remaining, [...restCandidates, ...leftoverFirst], rng);
  const availableIndices = new Set([...firstWindowPicks, ...restPicks]);

  return dayHeaders.map((day, dayIndex) => {
    const slots: PublicAvailabilitySlot[] = [];
    const usedTimes = new Set<string>();
    const futurePool = futureTimesForDay(day.dateKey, now);
    if (futurePool.length === 0) {
      return { ...day, slots };
    }

    for (let slotIndex = 0; slotIndex < MANUAL_PREVIEW_SLOTS_PER_DAY; slotIndex += 1) {
      const flatIndex = dayIndex * MANUAL_PREVIEW_SLOTS_PER_DAY + slotIndex;
      if (!availableIndices.has(flatIndex)) continue;

      const preferred =
        SLOT_TIME_POOL[(dayIndex * MANUAL_PREVIEW_SLOTS_PER_DAY + slotIndex) % SLOT_TIME_POOL.length];
      let timeLabel: string | null =
        futurePool.includes(preferred) && !usedTimes.has(preferred) ? preferred : null;

      if (!timeLabel) {
        timeLabel = futurePool.find((candidate) => !usedTimes.has(candidate)) ?? null;
      }
      if (!timeLabel) continue;

      usedTimes.add(timeLabel);
      slots.push({
        slotKey: `${day.dateKey}-${slotIndex}`,
        timeLabel,
      });
    }

    slots.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));
    return { ...day, slots };
  });
}
