import { createHmac, timingSafeEqual } from "node:crypto";

export type AppointmentCalendarAudience = "patient" | "doctor";

function calendarTokenSecret(): string {
  return (
    process.env.APPOINTMENT_CALENDAR_TOKEN_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function calendarTokenPayload(
  appointmentId: string,
  audience: AppointmentCalendarAudience
): string {
  return `${audience}:${appointmentId.trim()}`;
}

export function buildAppointmentCalendarToken(
  appointmentId: string,
  audience: AppointmentCalendarAudience
): string | null {
  const secret = calendarTokenSecret();
  const id = appointmentId.trim();
  if (!secret || !id) return null;

  return createHmac("sha256", secret)
    .update(calendarTokenPayload(id, audience))
    .digest("base64url");
}

export function isValidAppointmentCalendarToken(
  appointmentId: string,
  audience: AppointmentCalendarAudience,
  token: string | null | undefined
): boolean {
  const expected = buildAppointmentCalendarToken(appointmentId, audience);
  const provided = String(token ?? "").trim();
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
