/**
 * Booking limits per clinic (user, 2026-10-09; stored per clinic since 2026-10-11): how
 * far ahead, minimum notice and the online cancellation deadline belong to each clinic
 * (professional_clinics), with one "Apply to all my clinics" so a doctor with several
 * clinics does not set them three times. Each clinic arrives with its own
 * `bookingLimits` and goes back in its `locations[i]` of POST /api/doctor-settings.
 */

export type ClinicLimits = {
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  patientCancelNoticeHours: number;
};

export type ClinicLimitsById = Record<string, ClinicLimits>;

/** Each clinic's own limits; `fallback` only fills a clinic that arrived without any. */
export function initialClinicLimits(
  workplaces: Array<{ id: string; bookingLimits?: ClinicLimits | null }>,
  fallback: ClinicLimits,
): ClinicLimitsById {
  const byClinic: ClinicLimitsById = {};
  for (const row of workplaces) byClinic[row.id] = { ...(row.bookingLimits ?? fallback) };
  return byClinic;
}

/** One clinic's limit changed: only that clinic's. */
export function setClinicLimit(byClinic: ClinicLimitsById, id: string, patch: Partial<ClinicLimits>): ClinicLimitsById {
  const next: ClinicLimitsById = {};
  for (const [key, limits] of Object.entries(byClinic)) {
    next[key] = key === id ? { ...limits, ...patch } : limits;
  }
  return next;
}

export function applyLimitsToAllClinics(byClinic: ClinicLimitsById, sourceId: string): ClinicLimitsById {
  const source = byClinic[sourceId];
  if (!source) return byClinic;
  return Object.fromEntries(Object.keys(byClinic).map((key) => [key, { ...source }]));
}

export function clinicsShareLimits(byClinic: ClinicLimitsById): boolean {
  const values = Object.values(byClinic).map((limits) => JSON.stringify(limits));
  return values.every((value) => value === values[0]);
}

/**
 * The limits of the clinic the doctor just changed, for the form's own snapshot (the
 * API reads each clinic's limits from its entry). No clinic ranks above another.
 */
export function accountLimitsFor(
  byClinic: ClinicLimitsById,
  changedClinicId: string,
  fallback: ClinicLimits,
): ClinicLimits {
  return { ...(byClinic[changedClinicId] ?? fallback) };
}
