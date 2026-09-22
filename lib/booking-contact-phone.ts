// lib/booking-contact-phone.ts
// A professional who stops taking online bookings must still leave patients a way to
// reach them. Pausing is per clinic (doctor_locations.pause_online_bookings) while the
// public Call button is per account (professional_settings.show_phone_public). One
// paused clinic is enough to strand the patients looking at it — the other clinic's
// calendar is no use to someone who wants to be seen at this one — so the requirement
// bites as soon as ANY clinic stops taking online bookings.

import { cyprusPhoneDigits, formatCyprusPhoneDisplay } from "@/lib/phone-link";
import {
  callNumberForSource,
  inferPublicPhoneSource,
  type PublicPhoneSource,
} from "@/lib/public-call-phone";

export type ClinicPauseState = { id: string; pauseOnlineBookings: boolean };

export const CONTACT_PHONE_REQUIRED_CODE = "contact_phone_required";
export const CONTACT_PHONE_REQUIRED_MESSAGE =
  "Add a phone number patients can call before pausing online bookings.";

export const CALL_LOCKED_WHILE_PAUSED_CODE = "call_locked_while_paused";
export const CALL_LOCKED_WHILE_PAUSED_MESSAGE =
  "Online bookings are paused, so your phone stays visible. Resume online bookings to hide it.";

/** At least one clinic takes no online bookings, so some patients need a phone. */
export function anyClinicPaused(pauseFlags: readonly boolean[]): boolean {
  if (pauseFlags.length === 0) return false;
  return pauseFlags.some(Boolean);
}

/** The pause flags the account would land on after flipping one clinic. */
export function pauseFlagsAfterChange(
  clinics: readonly ClinicPauseState[],
  clinicId: string,
  paused: boolean,
): boolean[] {
  return clinics.map((clinic) =>
    clinic.id === clinicId ? paused : Boolean(clinic.pauseOnlineBookings),
  );
}

/** Accept a Cyprus number typed in any common shape; null when it cannot be one. */
export function normalizeContactPhone(value?: string | null): string | null {
  const digits = cyprusPhoneDigits(value);
  if (!digits || digits.length < 8) return null;
  return formatCyprusPhoneDisplay(value);
}

export type ContactPhoneState = {
  /** A clinic is paused: the patients looking at it need a phone number. */
  required: boolean;
  source: PublicPhoneSource;
  /** The number patients would see; "" when the account has none. */
  callNumber: string;
  /** Required, but nothing to show yet — ask for a number before pausing. */
  needsNumber: boolean;
  /** Required and available — the Call button is forced on and cannot be switched off. */
  lockCallOn: boolean;
};

export function contactPhoneState(input: {
  pauseFlags: readonly boolean[];
  mobileNumber?: string | null;
  directoryPhone?: string | null;
  publicPhoneSource?: unknown;
}): ContactPhoneState {
  const mobileNumber = String(input.mobileNumber ?? "").trim();
  const directoryPhone = String(input.directoryPhone ?? "").trim();
  const source = inferPublicPhoneSource({
    saved: input.publicPhoneSource,
    mobileNumber,
    directoryPhone,
  });
  const callNumber = callNumberForSource({ source, mobileNumber, directoryPhone });
  const required = anyClinicPaused(input.pauseFlags);
  return {
    required,
    source,
    callNumber,
    needsNumber: required && callNumber.length === 0,
    lockCallOn: required && callNumber.length > 0,
  };
}

/**
 * True when an account has a paused clinic and a number, but never had the Call button
 * switched on — the state every new professional starts in, since clinics are created
 * paused. Without this the settings UI shows a locked-on Call button while the public
 * profile still shows nothing at all.
 */
export function shouldRevealPublicPhone(input: {
  pauseFlags: readonly boolean[];
  mobileNumber?: string | null;
  directoryPhone?: string | null;
  publicPhoneSource?: unknown;
  showPhonePublic: boolean;
}): boolean {
  if (input.showPhonePublic) return false;
  return contactPhoneState(input).lockCallOn;
}
