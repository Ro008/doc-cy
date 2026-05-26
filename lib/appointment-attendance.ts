/** Doctor-marked attendance on a past confirmed visit (MVP: no-show only). */
export const APPOINTMENT_ATTENDANCE_NO_SHOW = "no_show" as const;

export type AppointmentAttendance =
  | typeof APPOINTMENT_ATTENDANCE_NO_SHOW
  | null;

export function normalizeAppointmentAttendance(
  raw: string | null | undefined,
): AppointmentAttendance {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === APPOINTMENT_ATTENDANCE_NO_SHOW
    ? APPOINTMENT_ATTENDANCE_NO_SHOW
    : null;
}

export function isNoShowAttendance(
  raw: string | null | undefined,
): boolean {
  return normalizeAppointmentAttendance(raw) === APPOINTMENT_ATTENDANCE_NO_SHOW;
}

export function parseAttendanceFromBody(
  raw: unknown,
): AppointmentAttendance | "invalid" {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw === APPOINTMENT_ATTENDANCE_NO_SHOW) return APPOINTMENT_ATTENDANCE_NO_SHOW;
  return "invalid";
}
