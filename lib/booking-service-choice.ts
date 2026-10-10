/**
 * The service a patient picks on the public booking form (user, 2026-10-09): one of the
 * professional's own services, or Other. The free text ("reason for visit") stays: optional
 * with a service, required with Other or when she lists no services (user, 2026-10-09).
 * Only shown when she lists services; never with prices.
 *
 * Saved by POST /api/appointments as `professionalServiceId` → appointments.professional_service_id
 * (+ appointments.service_name, copied by the database). See lib/requested-service.ts.
 */

export const BOOKING_SERVICE_OTHER = "other";

export type BookingServiceItem = { id: string; name: string };

export function bookingServiceOptions(
  services: BookingServiceItem[],
  otherLabel: string,
): { value: string; label: string }[] {
  if (services.length === 0) return [];
  return [
    ...services.map((service) => ({ value: service.id, label: service.name })),
    { value: BOOKING_SERVICE_OTHER, label: otherLabel },
  ];
}

/**
 * The fields for POST /api/appointments. `choice` is null when there is no picker.
 * The database requires a reason on every booking (appointments_booking_fields_check): with a
 * service the patient's words are optional, so when they leave them out the service name goes
 * as the reason (screens drop it as a repeat; see lib/visit-purpose.ts).
 */
export function bookingServiceRequest(input: {
  choice: string | null;
  services: BookingServiceItem[];
  visitReason: string;
}): { professionalServiceId?: string; reason: string } {
  const service = input.services.find((s) => s.id === input.choice);
  // With a service the patient's words are optional; without them the service name is the reason.
  if (service) return { professionalServiceId: service.id, reason: input.visitReason.trim() || service.name };
  return { reason: input.visitReason.trim() };
}
