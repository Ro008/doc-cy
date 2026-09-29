import { computeProposalExpiresAt } from "@/lib/proposal-expires-at";

/** Same limits the propose-reschedule API enforces for a confirmed visit. */
export const RESCHEDULE_REASON_MIN = 10;
export const RESCHEDULE_REASON_MAX = 4000;

export function rescheduleReasonState(raw: string): {
  length: number;
  tooShort: boolean;
  tooLong: boolean;
  remaining: number;
} {
  const length = raw.trim().length;
  return {
    length,
    tooShort: length < RESCHEDULE_REASON_MIN,
    tooLong: length > RESCHEDULE_REASON_MAX,
    remaining: RESCHEDULE_REASON_MAX - length,
  };
}

function toMinuteSet(isoList: readonly string[]): Set<number> {
  const out = new Set<number>();
  for (const iso of isoList) {
    const ms = new Date(iso).getTime();
    if (Number.isFinite(ms)) out.add(Math.round(ms / 60_000));
  }
  return out;
}

/**
 * The server picks the times again when the proposal is sent, so they can differ from the
 * preview the doctor saw (someone booked meanwhile, or a time got too close). True when any
 * sent time was not previewed.
 */
export function sentSlotsDifferFromPreview(
  preview: readonly string[] | null | undefined,
  sent: readonly string[],
): boolean {
  if (!preview || preview.length === 0) return false;
  if (preview.length !== sent.length) return true;
  const previewed = toMinuteSet(preview);
  for (const minute of toMinuteSet(sent)) {
    if (!previewed.has(minute)) return true;
  }
  return false;
}

/** When the patient's choice will expire, computed exactly like the server does. */
export function rescheduleDeadlineIso(now: Date, slotIsoList: readonly string[]): string | null {
  const earliest = [...slotIsoList]
    .map((iso) => new Date(iso).getTime())
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b)[0];
  if (earliest == null) return null;
  return computeProposalExpiresAt(now, new Date(earliest).toISOString()).toISOString();
}
