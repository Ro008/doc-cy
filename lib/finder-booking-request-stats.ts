/** Rolling 30-day window for unregistered ranking and the scarcity badge. */
export const FINDER_BOOKING_REQUEST_WINDOW_DAYS = 30;

export type BookingRequestEventRow = {
  professionalId: string;
  id: string;
  voterKey: string | null;
};

export type BookingRequestStats = {
  /** Every stored tap in the window — used for unregistered ranking buckets. */
  requests30d: number;
  /** Distinct patients in the window — used for the public badge. */
  uniquePatients30d: number;
};

export function finderBookingRequestWindowSinceIso(now = Date.now()): string {
  return new Date(
    now - FINDER_BOOKING_REQUEST_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export function aggregateBookingRequestStats(
  rows: readonly BookingRequestEventRow[],
): Map<string, BookingRequestStats> {
  const byProfessional = new Map<string, { requests30d: number; voters: Set<string> }>();
  for (const row of rows) {
    const professionalId = String(row.professionalId ?? "").trim();
    if (!professionalId) continue;
    const tapId = String(row.id ?? "").trim();
    const voterKey = String(row.voterKey ?? "").trim();
    const voterId = voterKey || (tapId ? `legacy:${tapId}` : "");
    const current = byProfessional.get(professionalId) ?? {
      requests30d: 0,
      voters: new Set<string>(),
    };
    current.requests30d += 1;
    if (voterId) current.voters.add(voterId);
    byProfessional.set(professionalId, current);
  }

  const out = new Map<string, BookingRequestStats>();
  for (const [professionalId, current] of byProfessional.entries()) {
    out.set(professionalId, {
      requests30d: current.requests30d,
      uniquePatients30d: current.voters.size,
    });
  }
  return out;
}

export function formatFinderRequestBadgeLabel(uniquePatients30d: number): string | null {
  if (uniquePatients30d < 1) return null;
  const patientLabel = uniquePatients30d === 1 ? "patient" : "patients";
  return `🔥 ${uniquePatients30d} ${patientLabel} requested online booking this month`;
}
