import { hasProAccess } from "@/lib/pro-access";

/**
 * Who can be booked (user, 2026-10-02). Checked on the server by the booking routes and
 * by the public calendar; the UI only mirrors it.
 * - Online: registered, pro access live, clinic not archived, clinic not paused.
 * - Manual: registered, pro access live, clinic not archived. Pausing only stops
 *   patients booking online; she can still add phone / walk-in visits.
 * - Access expired: nothing new, online or manual (existing visits stay hers to handle).
 */
export type BookingPermissionInput = {
  isRegistered: boolean;
  proAccessUntil: string | Date | null | undefined;
  clinicPaused: boolean;
  clinicArchived: boolean;
};

export type BookingRefusal = "not_registered" | "access_expired" | "clinic_archived" | "clinic_paused";

export type BookingPermission = { allowed: true } | { allowed: false; reason: BookingRefusal };

function baseRefusal(input: BookingPermissionInput, now: Date): BookingRefusal | null {
  if (!input.isRegistered) return "not_registered";
  if (!hasProAccess(input.proAccessUntil, now)) return "access_expired";
  if (input.clinicArchived) return "clinic_archived";
  return null;
}

export function onlineBookingPermission(
  input: BookingPermissionInput,
  now: Date = new Date(),
): BookingPermission {
  const refusal = baseRefusal(input, now) ?? (input.clinicPaused ? "clinic_paused" : null);
  return refusal ? { allowed: false, reason: refusal } : { allowed: true };
}

export function manualBookingPermission(
  input: BookingPermissionInput,
  now: Date = new Date(),
): BookingPermission {
  const refusal = baseRefusal(input, now);
  return refusal ? { allowed: false, reason: refusal } : { allowed: true };
}
