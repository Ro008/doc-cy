import type { CallToBookSource } from "@/lib/call-to-book";

/**
 * Point E4: one append-only table for what people do on the site (user, 2026-10-01).
 * Shared fields are columns; what only one event type has goes in `details`, whose
 * shape this module builds and checks. Service role only.
 */
export const USER_EVENTS_TABLE = "user_events";

export const USER_EVENT_TYPES = [
  "show_clinic_phone_number",
  "show_personal_mobile_number",
  "request_online_appointment",
  "missing_professional_report",
  "support_message",
] as const;

export type UserEventType = (typeof USER_EVENT_TYPES)[number];

/**
 * Where a click was, and whether the professional was registered at that moment
 * (user, 2026-10-15): a listing that signs up later keeps its earlier clicks as unregistered.
 */
export type UserEventSource =
  | "registered_professional_profile_page"
  | "unregistered_professional_profile_page"
  | "registered_professional_finder_card"
  | "unregistered_professional_finder_card"
  | "clinic_page"
  | "finder_empty_state"
  | "support_form";

/** The stored source for a phone button's place. */
export function userEventSourceFor(place: CallToBookSource, isRegistered: boolean): UserEventSource {
  if (place === "clinic_page") return "clinic_page";
  const who = isRegistered ? "registered" : "unregistered";
  return place === "finder_card" ? `${who}_professional_finder_card` : `${who}_professional_profile_page`;
}

/**
 * The founders' call-to-book and vote counts are about unregistered listings (the demand to
 * show them before they sign up).
 */
export const FOUNDER_LISTING_SOURCES = [
  "unregistered_professional_finder_card",
  "unregistered_professional_profile_page",
] as const;

/** What a visitor typed in the finder's "can't find your professional?" card. */
export type MissingProfessionalReportDetails = {
  requested_name: string;
  specialty: string | null;
  district: string | null;
  search_name: string | null;
};

export type UserEventInsert = {
  event_type: UserEventType;
  actor_type: "visitor" | "professional";
  /** Only a signed-in sender has one (support messages). */
  actor_id?: string | null;
  visitor_key: string | null;
  professional_id: string | null;
  clinic_id: string | null;
  source: UserEventSource;
  details: Record<string, unknown>;
};

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * A clinic's phone revealed: on a finder card or a profile (the professional and the clinic),
 * or on the clinic's own page (the clinic only).
 */
export function showClinicPhoneNumberEvent(input: {
  professionalId: string | null;
  clinicId: string;
  source: UserEventSource;
}): UserEventInsert {
  return {
    event_type: "show_clinic_phone_number",
    actor_type: "visitor",
    visitor_key: null,
    professional_id: input.professionalId,
    clinic_id: input.clinicId,
    source: input.source,
    details: {},
  };
}

/**
 * Her personal mobile revealed: "Show mobile" on her profile, or "Mobile Number" on her finder
 * card (user, 2026-10-16). Registered professionals only.
 */
export function showPersonalMobileNumberEvent(input: {
  professionalId: string;
  place?: "profile_page" | "finder_card";
}): UserEventInsert {
  return {
    event_type: "show_personal_mobile_number",
    actor_type: "visitor",
    visitor_key: null,
    professional_id: input.professionalId,
    clinic_id: null,
    source:
      input.place === "finder_card"
        ? "registered_professional_finder_card"
        : "registered_professional_profile_page",
    details: {},
  };
}

/**
 * A visitor's vote for online appointments with a listing (one per visitor, enforced by the
 * database). Only unregistered listings take votes.
 */
export function onlineAppointmentRequestEvent(input: {
  professionalId: string;
  clinicId: string | null;
  source: CallToBookSource;
  visitorKey: string | null;
}): UserEventInsert {
  return {
    event_type: "request_online_appointment",
    actor_type: "visitor",
    visitor_key: textOrNull(input.visitorKey),
    professional_id: input.professionalId,
    clinic_id: input.clinicId,
    source: userEventSourceFor(input.source, false),
    details: {},
  };
}

export function missingProfessionalReportEvent(input: {
  details: MissingProfessionalReportDetails;
  visitorKey: string | null;
}): UserEventInsert {
  return {
    event_type: "missing_professional_report",
    actor_type: "visitor",
    visitor_key: textOrNull(input.visitorKey),
    professional_id: null,
    clinic_id: null,
    source: "finder_empty_state",
    details: { ...input.details },
  };
}

/** What a support-form submission keeps: everything the sender and the page gave us. */
export type SupportMessageDetails = {
  topic: string;
  message: string;
  email: string | null;
  url: string | null;
  user_id?: string | null;
  context: Record<string, string> | null;
};

/**
 * A message from the support form (user, 2026-10-16): kept forever, so it names no professional
 * (purging one deletes their events). A signed-in sender is the actor; every account today is a
 * professional's or an applicant's, and patient accounts are not built yet.
 */
export function supportMessageEvent(input: {
  userId: string | null;
  visitorKey: string | null;
  details: SupportMessageDetails;
}): UserEventInsert {
  return {
    event_type: "support_message",
    actor_type: input.userId ? "professional" : "visitor",
    actor_id: input.userId,
    visitor_key: textOrNull(input.visitorKey),
    professional_id: null,
    clinic_id: null,
    source: "support_form",
    details: { ...input.details, user_id: input.userId },
  };
}

/** Reads a stored report's `details`; null when it has no requested name. */
export function parseMissingProfessionalReportDetails(
  value: unknown,
): MissingProfessionalReportDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const requestedName = textOrNull(raw.requested_name);
  if (!requestedName) return null;
  return {
    requested_name: requestedName,
    specialty: textOrNull(raw.specialty),
    district: textOrNull(raw.district),
    search_name: textOrNull(raw.search_name),
  };
}

/** Postgres unique violation, e.g. a second vote from the same visitor. */
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return String(error?.code ?? "") === "23505";
}

/** One row from the `founder_user_event_stats` SQL aggregate (per professional, one event type). */
export type UserEventStatRow = {
  professional_id: string;
  event_count: number | string | null;
  visitor_count: number | string | null;
  finder_count: number | string | null;
  profile_count: number | string | null;
  last_at: string | null;
};
