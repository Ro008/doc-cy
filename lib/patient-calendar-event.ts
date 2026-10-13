import { formatCyprusPhoneDisplay } from "@/lib/phone-link";

/** Minimal appointment shape for shared calendar copy (datetime reserved for future use). */
export type PatientCalendarAppointment = {
  id?: string;
  appointment_datetime?: string | null;
};

/** Doctor fields needed for patient-facing calendar events (Google, ICS, email). */
export type PatientCalendarDoctor = {
  name?: string | null;
  /** Canonical value from the master list when possible; custom text otherwise. */
  specialty?: string | null;
  phone?: string | null;
  clinic_address?: string | null;
  /** The clinic's name, shown in the location and the description. */
  clinic_name?: string | null;
  /** Link to the clinic's Google Maps pin (`clinicMapsUrl`). */
  maps_url?: string | null;
};

export type PatientCalendarEventDetails = {
  /** Google Calendar `text` / ICS SUMMARY */
  title: string;
  /** Google Calendar `details` / ICS DESCRIPTION */
  description: string;
  /** Google Calendar `location` / ICS LOCATION — clinic address from DB when set */
  location: string;
};

/** Optional visit context for calendar copy (patient-facing description). */
export type PatientCalendarVisitReason = {
  visitType?: string | null | undefined;
  visitNotes?: string | null;
  reason?: string | null;
};

export type PatientCalendarEventOptions = {
  /**
   * When true, description tells the patient they can contact the clinic directly
   * (post-confirmation). Keep false for pending / counter-offer flows.
   */
  includeDirectClinicContact?: boolean;
};

/**
 * Clinician name for calendar titles: strip leading honorific, keep full name.
 */
export function doctorDisplayNameForCalendar(
  fullName: string | null | undefined,
): string {
  const cleaned = String(fullName ?? "")
    .replace(/^dr\.?\s+/i, "")
    .trim();
  return cleaned || "Professional";
}

/**
 * Unified title, description, and location for patient calendar links (success page, Resend, .ics).
 */
export function getCalendarEventDetails(
  _appointment: PatientCalendarAppointment,
  doctor: PatientCalendarDoctor,
  visit?: PatientCalendarVisitReason | null,
  options?: PatientCalendarEventOptions | null
): PatientCalendarEventDetails {
  const doctorLabel = doctorDisplayNameForCalendar(doctor.name);
  const title = `🩺 Doctor appointment: ${doctorLabel}`;

  const includeDirect = Boolean(options?.includeDirectClinicContact);
  const contactLine = includeDirect
    ? "To change or cancel your visit, please contact the clinic directly."
    : "Manage this visit through DocCy. You will receive email updates; please do not arrange changes outside the app until your visit is confirmed.";

  const reason = String(visit?.reason ?? "").trim();
  const vt = String(visit?.visitType ?? "").trim();
  const vn = String(visit?.visitNotes ?? "").trim();
  const visitLines: string[] = [];
  if (reason) {
    visitLines.push(`Reason: ${reason}`);
  } else if (vt) {
    visitLines.push(`Visit type: ${vt}`);
  }
  if (vn) {
    visitLines.push(`Notes: ${vn}`);
  }
  if (visitLines.length > 0) {
    visitLines.push("");
  }

  const clinicName = String(doctor.clinic_name ?? "").trim();
  const address = String(doctor.clinic_address ?? "").trim();
  const mapsUrl = String(doctor.maps_url ?? "").trim();
  const phone = formatCyprusPhoneDisplay(doctor.phone);
  const clinicLines: string[] = [];
  if (clinicName) clinicLines.push(`Clinic: ${clinicName}`);
  if (address) clinicLines.push(`Address: ${address}`);
  if (mapsUrl) clinicLines.push(`Map: ${mapsUrl}`);
  if (phone) clinicLines.push(`Phone: ${phone}`);
  if (clinicLines.length > 0) {
    clinicLines.push("");
  }

  const description = [
    ...visitLines,
    ...clinicLines,
    includeDirect ? "Confirmed via mydoccy.com" : "Request managed via mydoccy.com",
    "",
    contactLine,
  ].join("\n");

  const location = [clinicName, address].filter(Boolean).join(", ");

  return { title, description, location };
}

/**
 * Google Calendar "template" URL for patients.
 */
export function buildGoogleCalendarUrl(opts: {
  title: string;
  description?: string;
  location?: string;
  startUtc: Date;
  endUtc: Date;
}): string {
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(opts.startUtc)}/${fmt(opts.endUtc)}`,
    details: opts.description ?? "",
  });

  if (opts.location?.trim()) {
    params.set("location", opts.location.trim());
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
