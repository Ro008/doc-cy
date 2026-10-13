import { isVisitSlotEnded } from "@/lib/appointments";

/**
 * Attendance on a confirmed visit (user, 2026-10-04). The status stays CONFIRMED; the
 * scheduled job sets `attended` 2 h after the visit ends and she can switch to `no_show`
 * (and back) until the review email goes out 24 h after the visit.
 */
export const APPOINTMENT_ATTENDANCE_NO_SHOW = "no_show" as const;
export const APPOINTMENT_ATTENDANCE_ATTENDED = "attended" as const;

export type AppointmentAttendance =
  | typeof APPOINTMENT_ATTENDANCE_NO_SHOW
  | typeof APPOINTMENT_ATTENDANCE_ATTENDED
  | null;

export function normalizeAppointmentAttendance(
  raw: string | null | undefined,
): AppointmentAttendance {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === APPOINTMENT_ATTENDANCE_NO_SHOW) return APPOINTMENT_ATTENDANCE_NO_SHOW;
  if (s === APPOINTMENT_ATTENDANCE_ATTENDED) return APPOINTMENT_ATTENDANCE_ATTENDED;
  return null;
}

export function isNoShowAttendance(
  raw: string | null | undefined,
): boolean {
  return normalizeAppointmentAttendance(raw) === APPOINTMENT_ATTENDANCE_NO_SHOW;
}

/** A cleared value (the agenda's "Undo no-show") means attended. */
export function parseAttendanceFromBody(
  raw: unknown,
): Exclude<AppointmentAttendance, null> | "invalid" {
  if (raw === null || raw === undefined || raw === "") return APPOINTMENT_ATTENDANCE_ATTENDED;
  if (raw === APPOINTMENT_ATTENDANCE_NO_SHOW) return APPOINTMENT_ATTENDANCE_NO_SHOW;
  if (raw === APPOINTMENT_ATTENDANCE_ATTENDED) return APPOINTMENT_ATTENDANCE_ATTENDED;
  return "invalid";
}

export type AttendanceRefusal = {
  code: "not_confirmed" | "not_ended" | "review_sent";
  message: string;
};

export function attendanceChangeRefusal(input: {
  status: string | null | undefined;
  appointmentIso: string;
  durationMinutes: number | null | undefined;
  reviewRequestedAt: string | null | undefined;
  now: Date;
}): AttendanceRefusal | null {
  if (String(input.status ?? "").trim().toUpperCase() !== "CONFIRMED") {
    return { code: "not_confirmed", message: "Only confirmed visits can be marked for attendance." };
  }
  const duration =
    typeof input.durationMinutes === "number" && input.durationMinutes > 0 ? input.durationMinutes : 30;
  if (!isVisitSlotEnded(input.appointmentIso, duration, input.now.getTime())) {
    return { code: "not_ended", message: "Attendance can only be set after the visit time has passed." };
  }
  if (input.reviewRequestedAt) {
    return {
      code: "review_sent",
      message: "The patient has already been asked for a review, so attendance can't change any more.",
    };
  }
  return null;
}
