import type { CallToBookSource } from "@/lib/call-to-book";

/**
 * Point E4: one append-only table for what people do on the site (user, 2026-10-01).
 * Shared fields are columns; what only one event type has goes in `details`, whose
 * shape this module builds and checks. Service role only.
 */
export const USER_EVENTS_TABLE = "user_events";

export const USER_EVENT_TYPES = [
  "show_phone_number",
  "request_online_appointment",
  "missing_professional_report",
] as const;

export type UserEventType = (typeof USER_EVENT_TYPES)[number];

/** What a visitor typed in the finder's "can't find your professional?" card. */
export type MissingProfessionalReportDetails = {
  requested_name: string;
  specialty: string | null;
  district: string | null;
  search_name: string | null;
};

export type UserEventInsert = {
  event_type: UserEventType;
  actor_type: "visitor";
  visitor_key: string | null;
  professional_id: string | null;
  clinic_id: string | null;
  source: string;
  details: Record<string, unknown>;
};

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** A "Show phone number" click on a finder card or a professional's profile. */
export function showPhoneNumberEvent(input: {
  professionalId: string;
  clinicId: string | null;
  source: CallToBookSource;
}): UserEventInsert {
  return {
    event_type: "show_phone_number",
    actor_type: "visitor",
    visitor_key: null,
    professional_id: input.professionalId,
    clinic_id: input.clinicId,
    source: input.source,
    details: {},
  };
}

/** A visitor's vote for online appointments with a listing (one per visitor, enforced by the database). */
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
    source: input.source,
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
