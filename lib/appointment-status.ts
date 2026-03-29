export type AppointmentStatusCode = "REQUESTED" | "CONFIRMED" | "CANCELLED";

/** Calendar export and “add to calendar” are only allowed once confirmed. */
export function isConfirmedForCalendar(
  status: string | null | undefined
): boolean {
  return String(status ?? "").trim().toUpperCase() === "CONFIRMED";
}

export function isCancelledAppointmentStatus(
  status: string | null | undefined
): boolean {
  return String(status ?? "").trim().toUpperCase() === "CANCELLED";
}
