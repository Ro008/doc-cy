import { addHours } from "date-fns";

/**
 * Patient must respond by the earlier of: 24h from offer creation, or 2h before the first
 * proposed slot start. Never returns a time in the past (floored slightly after `now`).
 */
export function computeProposalExpiresAt(
  now: Date,
  firstProposedSlotStartIso: string
): Date {
  const firstStart = new Date(firstProposedSlotStartIso);
  const cap24h = addHours(now, 24);
  const cap2hBeforeSlot = addHours(firstStart, -2);
  const rawMs = Math.min(cap24h.getTime(), cap2hBeforeSlot.getTime());
  const floorMs = now.getTime() + 30_000;
  return new Date(Math.max(rawMs, floorMs));
}
