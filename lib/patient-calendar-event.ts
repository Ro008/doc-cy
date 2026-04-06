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
  visitType?: string | null | undefined;
  visitNotes?: string | null;
  reason?: string | null;
};

export type PatientCalendarEventOptions = {
  /**
   * When true, description may include the doctor WhatsApp link (post-confirmation only).
   * Keep false for pending / counter-offer flows to discourage off-app scheduling.
   */
  includeWhatsAppContact?: boolean;
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
  visit?: PatientCalendarVisitReason | null,
  options?: PatientCalendarEventOptions | null
): PatientCalendarEventDetails {
  const specialty = specialtyLabelForCalendar(doctor.specialty);
  const doctorLabel = doctorDisplayNameForCalendar(doctor.name);
  const title = `🩺 ${specialty}: ${doctorLabel}`;

  const includeWa = Boolean(options?.includeWhatsAppContact);
  const wa = includeWa ? phoneToWaMeLink(doctor.phone) : null;
  const waLine = includeWa
    ? wa
      ? `To change or cancel your visit, please contact the clinic directly via WhatsApp: ${wa}`
      : "To change or cancel your visit, please contact the clinic directly."
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

  const description = [
    ...visitLines,
    includeWa ? "Confirmed via DocCy." : "Request managed via DocCy.",
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
