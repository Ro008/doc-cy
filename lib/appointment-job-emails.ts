import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import { appointmentToCyprusDate } from "@/lib/appointments";
import type { BuiltEmail, EmailClinic } from "@/lib/booking-request-emails";
import { patientClinicBlockHtml, patientClinicBlockText } from "@/lib/patient-email-clinic";
import {
  EMAIL_CANCEL_BTN,
  EMAIL_CAL_GOOGLE_BTN,
  EMAIL_CAL_ICS_BTN,
  EMAIL_SECTION_LABEL,
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
  emailFallbackLink,
} from "@/lib/email-brand";
import { professionalFirstName } from "@/lib/professional-name";
import { AUTOMATED_EMAIL_FOOTER_TEXT, automatedEmailFooterHtml, escapeHtml } from "@/lib/resend";

/**
 * Patient emails the scheduled job sends (user, 2026-10-04): a request nobody answered in
 * time, and the reminder ~24 h before a visit (with the cancel link while it's open).
 * The review request is in lib/review-request-email.ts; the proposal reminder in
 * lib/reschedule-emails.ts.
 */

const P = `margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};`;
const MUTED = `margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};`;

function when(iso: string): { date: string; time: string } {
  const cy = appointmentToCyprusDate(iso);
  return { date: format(cy, "EEEE, d MMMM yyyy", { locale: enUS }), time: format(cy, "HH:mm") };
}

function hiName(full: string): string {
  return String(full ?? "").trim().split(/\s+/)[0] || "there";
}

export function buildPatientRequestExpiredEmail(opts: {
  patientName: string;
  professionalName: string;
  appointmentIso: string;
  bookUrl: string | null;
  clinic?: EmailClinic | null;
}): BuiltEmail {
  const { date, time } = when(opts.appointmentIso);
  const pro = professionalFirstName(opts.professionalName);
  const hi = hiName(opts.patientName);

  const subject = `${pro} couldn't reply to your request in time`;
  const line = `${pro} couldn't reply in time to your request for ${date} at ${time} (Cyprus time), so it was not booked.`;
  const text =
    `Hi ${hi},\n\n${line}\n\n` +
    (opts.clinic ? `${patientClinicBlockText(opts.clinic)}\n` : "") +
    (opts.bookUrl ? `You can book another time online:\n${opts.bookUrl}\n\n` : "") +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Your request was not booked</h2>
    <p style="${P}">Hi ${escapeHtml(hi)},</p>
    <p style="${P}">${escapeHtml(line)}</p>
    ${opts.clinic ? patientClinicBlockHtml(opts.clinic) : ""}
    ${opts.bookUrl ? `<a href="${escapeHtml(opts.bookUrl)}" style="${EMAIL_PRIMARY_BTN}">Book another time</a>` : ""}
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
  return { subject, text, html };
}

export function buildPatientVisitReminderEmail(opts: {
  patientName: string;
  professionalName: string;
  appointmentIso: string;
  clinic: EmailClinic;
  cancel: { url: string; deadlineLabel: string } | null;
  /** Add-to-calendar links, as in the confirmation email. */
  calendar?: { googleUrl: string; icsUrl: string } | null;
}): BuiltEmail {
  const { date, time } = when(opts.appointmentIso);
  const pro = professionalFirstName(opts.professionalName);
  const hi = hiName(opts.patientName);

  const subject = `Reminder: your visit with ${pro} on ${date}`;
  const line = `This is a reminder of your visit with ${pro} on ${date} at ${time} (Cyprus time).`;
  const cancelText = opts.cancel
    ? `Can't make it? Cancel online until ${opts.cancel.deadlineLabel}:\n${opts.cancel.url}\n\n`
    : "";
  const calText = opts.calendar
    ? `Add it to your calendar:\nGoogle Calendar: ${opts.calendar.googleUrl}\nApple / Outlook (.ics): ${opts.calendar.icsUrl}\n\n`
    : "";
  const text = `Hi ${hi},\n\n${line}\n\n${patientClinicBlockText(opts.clinic)}\n${calText}${cancelText}---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">See you soon</h2>
    <p style="${P}">Hi ${escapeHtml(hi)},</p>
    <p style="${P}">${escapeHtml(line)}</p>
    ${patientClinicBlockHtml(opts.clinic)}
    ${
      opts.calendar
        ? `<p style="${EMAIL_SECTION_LABEL}">Calendar</p>
    <a href="${escapeHtml(opts.calendar.googleUrl)}" style="${EMAIL_CAL_GOOGLE_BTN}">Add to Google Calendar</a>
    <a href="${escapeHtml(opts.calendar.icsUrl)}" style="${EMAIL_CAL_ICS_BTN}">Add to Apple / Outlook (.ics)</a>`
        : ""
    }
    ${
      opts.cancel
        ? `<p style="${P}">Can't make it? You can cancel online until <strong>${escapeHtml(
            opts.cancel.deadlineLabel,
          )}</strong> (Cyprus time).</p>
    <a href="${escapeHtml(opts.cancel.url)}" style="${EMAIL_CANCEL_BTN}">Cancel this appointment</a>
    <p style="${MUTED}">If the button does not work, copy this link: ${emailFallbackLink(opts.cancel.url)}</p>`
        : ""
    }
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
  return { subject, text, html };
}
