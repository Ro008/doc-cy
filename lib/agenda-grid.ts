import { isRescheduleProposalLive } from "@/lib/appointments";

type AgendaGridSourceRow = {
  id: string;
  appointment_datetime: string;
  status?: string | null;
  proposed_slots?: unknown;
  proposal_expires_at?: string | null;
};

export type AgendaGridRow<T> = T & {
  rowKey: string;
  gridStartIso: string;
  isCounterOfferHold: boolean;
};

export function parseProposedSlotIsoList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/**
 * One grid row per visible block. A live counter-offer expands to one row per
 * proposed start (those are the times it holds). A counter-offer the patient
 * let expire holds nothing, not even its original time, so it is not drawn:
 * that time is free to book (see blockingIntervalsFromAppointment).
 */
export function expandAgendaAppointmentsForGrid<T extends AgendaGridSourceRow>(
  appointments: T[],
  nowMs: number,
): AgendaGridRow<T>[] {
  const out: AgendaGridRow<T>[] = [];
  for (const a of appointments) {
    const su = String(a.status ?? "").trim().toUpperCase();
    const proposalLive = isRescheduleProposalLive(su, a.proposal_expires_at, nowMs);
    if (su === "NEEDS_RESCHEDULE" && !proposalLive) continue;

    const slots = proposalLive ? parseProposedSlotIsoList(a.proposed_slots) : [];
    if (slots.length > 0) {
      slots.forEach((iso, i) => {
        out.push({
          ...a,
          rowKey: `${a.id}-proposal-${i}`,
          gridStartIso: iso,
          isCounterOfferHold: true,
        });
      });
    } else {
      out.push({
        ...a,
        rowKey: a.id,
        gridStartIso: a.appointment_datetime,
        isCounterOfferHold: false,
      });
    }
  }
  return out;
}
