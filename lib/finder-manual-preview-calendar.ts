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

/** Stable fake availability: 4–6 open slots per manual listing (seeded per card). */
export function buildManualPreviewCalendar(
  dayHeaders: FinderAvailabilityDayHeader[],
  seedKey: string,
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

    for (let slotIndex = 0; slotIndex < MANUAL_PREVIEW_SLOTS_PER_DAY; slotIndex += 1) {
      const flatIndex = dayIndex * MANUAL_PREVIEW_SLOTS_PER_DAY + slotIndex;
      if (!availableIndices.has(flatIndex)) continue;

      const timeLabel =
        SLOT_TIME_POOL[(dayIndex * MANUAL_PREVIEW_SLOTS_PER_DAY + slotIndex) % SLOT_TIME_POOL.length];
      slots.push({
        slotKey: `${day.dateKey}-${slotIndex}`,
        timeLabel,
      });
    }

    return { ...day, slots };
  });
}
