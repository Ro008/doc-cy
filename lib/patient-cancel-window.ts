/**
 * Cancelling a confirmed visit (user, 2026-10-04):
 * - The patient, from the emailed link, until X hours before the visit, where X is
 *   `professional_settings.patient_cancel_notice_hours` (12 / 24 / 48, default 12 since 2026-10-08,
 *   agreed with Livio: the reminder goes out 24 h before, so it can still carry the cancel link).
 *   After that the page shows the clinic phone instead.
 * - The professional, until the visit starts; inside the patient's window her dialog
 *   warns that it is short notice.
 */

export const PATIENT_CANCEL_NOTICE_CHOICES = [12, 24, 48] as const;
export const DEFAULT_PATIENT_CANCEL_NOTICE_HOURS = 12;

const HOUR_MS = 60 * 60 * 1000;

export function parsePatientCancelNoticeHours(value: unknown): number {
  const n = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
  return typeof n === "number" && (PATIENT_CANCEL_NOTICE_CHOICES as readonly number[]).includes(n)
    ? n
    : DEFAULT_PATIENT_CANCEL_NOTICE_HOURS;
}

/** The last moment the patient can cancel online. */
export function patientCancelDeadline(visitStartIso: string, noticeHours: number): Date {
  return new Date(new Date(visitStartIso).getTime() - noticeHours * HOUR_MS);
}

export function patientCanCancel(visitStartIso: string, noticeHours: number, now: Date = new Date()): boolean {
  const deadline = patientCancelDeadline(visitStartIso, noticeHours).getTime();
  return Number.isFinite(deadline) && now.getTime() <= deadline;
}

/** The professional cancels inside the patient's notice window (she may, but is warned). */
export function professionalCancelIsShortNotice(
  visitStartIso: string,
  noticeHours: number,
  now: Date = new Date(),
): boolean {
  const deadline = patientCancelDeadline(visitStartIso, noticeHours).getTime();
  return Number.isFinite(deadline) && now.getTime() > deadline;
}
