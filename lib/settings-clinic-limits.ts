/**
 * Booking limits per clinic (user, 2026-10-09): how far ahead, minimum notice and the
 * online cancellation deadline belong to each clinic, with one "Apply to all my
 * clinics" so a doctor with several clinics does not set them three times.
 *
 * EXPECTED TO FAIL until Livio stores them per clinic (professional_clinics columns,
 * loaded into each location's `bookingLimits` and read from each `locations[i]` of
 * POST /api/doctor-settings). Until then the backend keeps one value per professional
 * (professional_settings): a change shows on every clinic and the UI says so.
 */

export type ClinicLimits = {
  bookingHorizonDays: number;
  minimumNoticeHours: number;
  patientCancelNoticeHours: number;
};

export type ClinicLimitsById = Record<string, ClinicLimits>;

export const PER_CLINIC_LIMITS_PENDING =
  "Expected for now: these limits apply to all your clinics until Livio stores them per clinic in the backend (professional_clinics).";

export function initialClinicLimits(
  workplaces: Array<{ id: string; bookingLimits?: ClinicLimits | null }>,
  account: ClinicLimits,
): { byClinic: ClinicLimitsById; perClinicSaved: boolean } {
  const byClinic: ClinicLimitsById = {};
  let perClinicSaved = false;
  for (const row of workplaces) {
    if (row.bookingLimits) perClinicSaved = true;
    byClinic[row.id] = { ...(row.bookingLimits ?? account) };
  }
  return { byClinic, perClinicSaved };
}

/** One clinic's limit changed; with one value per professional it changes them all. */
export function setClinicLimit(
  byClinic: ClinicLimitsById,
  id: string,
  patch: Partial<ClinicLimits>,
  perClinicSaved: boolean,
): ClinicLimitsById {
  const next: ClinicLimitsById = {};
  for (const [key, limits] of Object.entries(byClinic)) {
    next[key] = !perClinicSaved || key === id ? { ...limits, ...patch } : limits;
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
 * The one value per professional the API still reads (professional_settings): the
 * limits of the clinic the doctor just changed. No clinic ranks above another; this
 * goes away once Livio stores limits per clinic.
 */
export function accountLimitsFor(
  byClinic: ClinicLimitsById,
  changedClinicId: string,
  fallback: ClinicLimits,
): ClinicLimits {
  return { ...(byClinic[changedClinicId] ?? fallback) };
}
