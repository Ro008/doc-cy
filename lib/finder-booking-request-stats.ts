/** Rolling 30-day window for unregistered ranking and the scarcity badge. */
export const FINDER_BOOKING_REQUEST_WINDOW_DAYS = 30;

export type BookingRequestEventRow = {
  professionalId: string;
  id: string;
  voterKey: string | null;
};

export type BookingRequestStats = {
  /** Every stored tap in the window (analytics / founder dashboard). */
  requests30d: number;
  /** Distinct patients in the window — public badge and unregistered ranking. */
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

/** Listing ids with at least `minUnique` distinct patients in the 30-day window. */
export function professionalIdsWithUniqueRequests(
  stats: Map<string, BookingRequestStats>,
  minUnique = 1,
): string[] {
  const ids: string[] = [];
  for (const [id, value] of stats.entries()) {
    if (value.uniquePatients30d >= minUnique) ids.push(id);
  }
  return ids;
}

/** Dedupe listing rows by id, keeping the first occurrence. */
export function mergeManualDirectoryRowsById<T extends { id?: string }>(
  batches: ReadonlyArray<readonly T[]>,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const batch of batches) {
    for (const row of batch) {
      const id = String(row.id ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}

export function formatFinderRequestBadgeLabel(uniquePatients30d: number): string | null {
  if (uniquePatients30d < 1) return null;
  const patientLabel = uniquePatients30d === 1 ? "patient" : "patients";
  return `🔥 ${uniquePatients30d} ${patientLabel} requested online booking this month`;
}
