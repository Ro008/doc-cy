import { format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import type {
  FinderAvailabilityDayHeader,
  PublicAvailabilitySlot,
} from "@/lib/public/compute-public-booking-slots";

export const MANUAL_PREVIEW_SLOTS_PER_DAY = 4;

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

function pickUniqueIndices(count: number, maxExclusive: number, rng: () => number): number[] {
  const indices = new Set<number>();
  let guard = 0;
  while (indices.size < count && guard < maxExclusive * 4) {
    indices.add(Math.floor(rng() * maxExclusive));
    guard += 1;
  }
  return Array.from(indices);
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
 * Stable fake availability: ~4–6 open slots per manual listing (seeded per card).
 * Never surfaces times that have already passed today (Cyprus wall clock).
 */
export function buildManualPreviewCalendar(
  dayHeaders: FinderAvailabilityDayHeader[],
  seedKey: string,
  now: Date = new Date(),
): ManualPreviewDay[] {
  if (dayHeaders.length === 0) return [];

  const rng = createSeededRng(seedFromString(seedKey));
  const availableCount = (2 + Math.floor(rng() * 2)) * 2;
  const totalSlots = dayHeaders.length * MANUAL_PREVIEW_SLOTS_PER_DAY;
  const availableIndices = new Set(
    pickUniqueIndices(Math.min(availableCount, totalSlots), totalSlots, rng),
  );

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
      let timeLabel =
        futurePool.includes(preferred) && !usedTimes.has(preferred) ? preferred : null;

      if (!timeLabel) {
        timeLabel =
          futurePool.find((candidate) => !usedTimes.has(candidate)) ?? null;
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
