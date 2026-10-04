import { createHash, randomBytes } from "node:crypto";

/**
 * Links emailed to patients: confirm a booking request, pick a proposed time, cancel a
 * visit, leave a review. The raw token travels only in the email; the database keeps
 * its SHA-256 (`appointment_drafts.token_hash`, `appointment_links.token_hash`), so a
 * leaked table can't be turned into working links. Each link is single-use and expires.
 */

/** The booking confirmation link lasts 30 minutes (user, 2026-10-02). */
export const BOOKING_CONFIRM_LINK_MINUTES = 30;

export type AppointmentLinkPurpose = "confirm" | "proposal" | "cancel" | "review";

/** Patient pages each link opens. */
export const APPOINTMENT_LINK_PATHS: Record<AppointmentLinkPurpose, string> = {
  confirm: "/booking/confirm",
  proposal: "/booking/choose",
  cancel: "/booking/cancel",
  review: "/review",
};

/** 32 random bytes, base64url (43 characters). */
export function newAppointmentLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAppointmentLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cheap check before touching the database: the shape newAppointmentLinkToken makes. */
export function isAppointmentLinkTokenShape(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function appointmentLinkUrl(
  siteUrl: string,
  purpose: AppointmentLinkPurpose,
  token: string,
): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}${APPOINTMENT_LINK_PATHS[purpose]}?token=${encodeURIComponent(token)}`;
}
