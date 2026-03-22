import { CLINIC_ADDRESS } from "@/lib/clinic-info";
import { isMasterSpecialty } from "@/lib/cyprus-specialties";
import { phoneToWaMeLink } from "@/lib/whatsapp";

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
};

export type PatientCalendarEventDetails = {
  /** Google Calendar `text` / ICS SUMMARY */
  title: string;
  /** Google Calendar `details` / ICS DESCRIPTION */
  description: string;
  /** Google Calendar `location` / ICS LOCATION — clinic address from DB with fallback */
  location: string;
};

/** Optional visit context for calendar copy (patient-facing description). */
export type PatientCalendarVisitReason = {
  visitType: string | null | undefined;
  visitNotes?: string | null;
};

/**
 * Last token of the doctor's name, after stripping a leading "Dr." prefix.
 */
export function doctorLastNameForCalendar(fullName: string | null | undefined): string {
  const cleaned = String(fullName ?? "")
    .replace(/^dr\.?\s+/i, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Doctor";
  return parts[parts.length - 1]!;
}

/**
 * Label for the calendar title: prefer a master-list specialty; otherwise stored text; fallback General Practice.
 */
export function specialtyLabelForCalendar(specialty: string | null | undefined): string {
  const s = String(specialty ?? "").trim();
  if (!s) return "General Practice";
  if (isMasterSpecialty(s)) return s;
  return s;
}

/**
 * Unified title, description, and location for patient calendar links (success page, Resend, .ics).
 */
export function getCalendarEventDetails(
  _appointment: PatientCalendarAppointment,
  doctor: PatientCalendarDoctor,
  visit?: PatientCalendarVisitReason | null
): PatientCalendarEventDetails {
  const specialty = specialtyLabelForCalendar(doctor.specialty);
  const last = doctorLastNameForCalendar(doctor.name);
  const title = `🩺 ${specialty}: Dr. ${last}`;

  const wa = phoneToWaMeLink(doctor.phone);
  const waLine = wa
    ? `To change or cancel your visit, please contact the clinic directly via WhatsApp: ${wa}`
    : "To change or cancel your visit, please contact the clinic directly.";

  const vt = String(visit?.visitType ?? "").trim();
  const vn = String(visit?.visitNotes ?? "").trim();
  const visitLines: string[] = [];
  if (vt) {
    visitLines.push(`Visit type: ${vt}`);
  }
  if (vn) {
    visitLines.push(`Notes: ${vn}`);
  }
  if (visitLines.length > 0) {
    visitLines.push("");
  }

  const description = [
    ...visitLines,
    "Confirmed via DocCy.",
    "",
    waLine,
  ].join("\n");

  const location =
    String(doctor.clinic_address ?? "").trim() || CLINIC_ADDRESS;

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
