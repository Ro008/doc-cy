/**
 * What a visit is for, for display: the service the patient picked (appointments.service_name,
 * user 2026-10-09) and their own words (appointments.reason). A picked service is also sent as
 * the reason (the database requires one; see lib/booking-service-choice.ts), so the reason is
 * dropped when it only repeats the service name.
 */
export function visitPurpose(input: {
  serviceName?: string | null;
  reason?: string | null;
}): { service: string | null; reason: string | null } {
  const service = String(input.serviceName ?? "").trim() || null;
  const reason = String(input.reason ?? "").trim() || null;
  if (service && reason && reason.toLowerCase() === service.toLowerCase()) {
    return { service, reason: null };
  }
  return { service, reason };
}
