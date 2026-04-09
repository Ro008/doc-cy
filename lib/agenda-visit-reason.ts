export function patientVisitReasonFromAppointmentRow(raw: {
  reason?: unknown;
}): string | null {
  const normalized = String(raw.reason ?? "").trim();
  return normalized ? normalized : null;
}
