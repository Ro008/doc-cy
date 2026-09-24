import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed links for a booking: the calendar download (patient or professional
 * version) and the request-sent page. Without a signature, anyone holding an
 * appointment id could open them, and `?audience=doctor` turned the patient's
 * link into the professional's version with the patient's phone number.
 *
 * The signature binds the appointment id to one audience, so a link can't be
 * re-pointed at another version or another booking. The key is derived from
 * the service-role key, which every server environment already has; rotating
 * that key invalidates outstanding links, which is fine for links that expire
 * a week after the appointment anyway.
 */
export type AppointmentLinkAudience = "patient" | "professional" | "request-sent";

/** Links keep working until this many days after the appointment. */
export const APPOINTMENT_LINK_GRACE_DAYS = 7;

const SIG_LENGTH = 22; // base64url of 16 bytes of HMAC-SHA256

function defaultSecret(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

export function signAppointmentLink(
  appointmentId: string,
  audience: AppointmentLinkAudience,
  secret: string = defaultSecret(),
): string | null {
  if (!secret || !appointmentId) return null;
  return createHmac("sha256", secret)
    .update(`appointment-link:v1|${appointmentId}|${audience}`)
    .digest("base64url")
    .slice(0, SIG_LENGTH);
}

export function verifyAppointmentLink(input: {
  id: string;
  audience: AppointmentLinkAudience;
  sig: string | null | undefined;
  secret?: string;
}): boolean {
  const given = String(input.sig ?? "");
  if (given.length !== SIG_LENGTH) return false;
  const expected = signAppointmentLink(input.id, input.audience, input.secret ?? defaultSecret());
  if (!expected) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** True once the link is past its grace period; an unreadable date counts as expired. */
export function isAppointmentLinkExpired(
  appointmentDatetime: string,
  now: Date = new Date(),
): boolean {
  const at = new Date(appointmentDatetime).getTime();
  if (!Number.isFinite(at)) return true;
  return now.getTime() > at + APPOINTMENT_LINK_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

export function appointmentCalendarPath(
  appointmentId: string,
  audience: "patient" | "professional",
  secret?: string,
): string | null {
  const sig = signAppointmentLink(appointmentId, audience, secret ?? defaultSecret());
  if (!sig) return null;
  return `/api/appointments/${encodeURIComponent(appointmentId)}/calendar?audience=${audience}&sig=${sig}`;
}

/** Query string for `/[locale]/[slug]/request-sent`, `appointmentId` first. */
export function appointmentRequestSentQuery(appointmentId: string, secret?: string): string | null {
  const sig = signAppointmentLink(appointmentId, "request-sent", secret ?? defaultSecret());
  if (!sig) return null;
  return `appointmentId=${encodeURIComponent(appointmentId)}&sig=${sig}`;
}
