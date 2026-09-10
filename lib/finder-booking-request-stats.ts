/** Lifetime unique-patient signal for unregistered ranking and the scarcity badge. */

export type BookingRequestEventRow = {
  professionalId: string;
  id: string;
  voterKey: string | null;
};

export type BookingRequestStats = {
  /** Every stored tap in the loaded set (diagnostics; badge uses uniquePatients). */
  requestTaps: number;
  /** Distinct patients (voter_key) — public badge and unregistered ranking. */
  uniquePatients: number;
};

export function aggregateBookingRequestStats(
  rows: readonly BookingRequestEventRow[],
): Map<string, BookingRequestStats> {
  const byProfessional = new Map<string, { requestTaps: number; voters: Set<string> }>();
  for (const row of rows) {
    const professionalId = String(row.professionalId ?? "").trim();
    if (!professionalId) continue;
    const tapId = String(row.id ?? "").trim();
    const voterKey = String(row.voterKey ?? "").trim();
    const voterId = voterKey || (tapId ? `legacy:${tapId}` : "");
    const current = byProfessional.get(professionalId) ?? {
      requestTaps: 0,
      voters: new Set<string>(),
    };
    current.requestTaps += 1;
    if (voterId) current.voters.add(voterId);
    byProfessional.set(professionalId, current);
  }

  const out = new Map<string, BookingRequestStats>();
  for (const [professionalId, current] of byProfessional.entries()) {
    out.set(professionalId, {
      requestTaps: current.requestTaps,
      uniquePatients: current.voters.size,
    });
  }
  return out;
}

/** Listing ids with at least `minUnique` distinct patients (lifetime). */
export function professionalIdsWithUniqueRequests(
  stats: Map<string, BookingRequestStats>,
  minUnique = 1,
): string[] {
  const ids: string[] = [];
  for (const [id, value] of stats.entries()) {
    if (value.uniquePatients >= minUnique) ids.push(id);
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

export function formatFinderRequestBadgeLabel(uniquePatients: number): string | null {
  if (uniquePatients < 1) return null;
  const patientLabel = uniquePatients === 1 ? "patient" : "patients";
  return `🔥 ${uniquePatients} ${patientLabel} requested online booking`;
}
