import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import { appointmentToCyprusDate } from "@/lib/appointments";
import { BOOKING_CONFIRM_LINK_MINUTES } from "@/lib/appointment-link-token";
import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";
import { professionalFirstName } from "@/lib/professional-name";
import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";
import { AUTOMATED_EMAIL_FOOTER_TEXT, automatedEmailFooterHtml, escapeHtml, sendResendEmail } from "@/lib/resend";

/**
 * The two emails of an online booking request (user, 2026-10-02/03):
 * 1. To the patient right after submitting: confirm with the link (30 min). Nothing
 *    reaches the professional until they do.
 * 2. To the professional once the patient confirmed: the new request, linking straight
 *    to its review page. The patient gets no further email at that point; the confirm
 *    page itself says "Request sent".
 */

export type EmailClinic = { name: string; address?: string | null };
export type BuiltEmail = { subject: string; text: string; html: string };

function whenLabels(iso: string): { date: string; time: string } {
  const cy = appointmentToCyprusDate(iso);
  return { date: format(cy, "EEEE, d MMMM yyyy", { locale: enUS }), time: format(cy, "HH:mm") };
}

function firstName(full: string): string {
  return String(full ?? "").trim().split(/\s+/)[0] || "there";
}

function clinicText(clinic: EmailClinic): string {
  return clinic.address ? `${clinic.name}, ${clinic.address}` : clinic.name;
}

const P = `margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};`;
const MUTED = `margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};`;

export function buildBookingConfirmLinkEmail(opts: {
  patientName: string;
  professionalName: string;
  appointmentIso: string;
  clinic: EmailClinic;
  confirmUrl: string;
}): BuiltEmail {
  const { date, time } = whenLabels(opts.appointmentIso);
  const pro = professionalFirstName(opts.professionalName);
  const hi = firstName(opts.patientName);
  const minutes = BOOKING_CONFIRM_LINK_MINUTES;

  const subject = `Confirm your appointment request with ${pro}`;
  const text =
    `Hi ${hi},\n\n` +
    `Please confirm your appointment request with ${pro} for ${date} at ${time} (Cyprus time), at ${clinicText(opts.clinic)}.\n\n` +
    `Confirm your request:\n${opts.confirmUrl}\n\n` +
    `This link works once and for ${minutes} minutes. Your request is not sent to ${pro} until you confirm.\n` +
    `If you didn't ask for this, you can ignore this email.\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Confirm your request</h2>
    <p style="${P}">Hi ${escapeHtml(hi)},</p>
    <p style="${P}">
      Please confirm your appointment request with <strong>${escapeHtml(pro)}</strong> for
      <strong>${escapeHtml(date)}</strong> at <strong>${escapeHtml(time)}</strong> (Cyprus time),
      at ${escapeHtml(clinicText(opts.clinic))}.
    </p>
    <a href="${escapeHtml(opts.confirmUrl)}" style="${EMAIL_PRIMARY_BTN}">Confirm my request</a>
    <p style="${P}">This link works once and for ${minutes} minutes. Your request is not sent to ${escapeHtml(pro)} until you confirm.</p>
    <p style="${MUTED}">If the button does not work, copy this link: ${escapeHtml(opts.confirmUrl)}</p>
    <p style="${MUTED}">If you didn't ask for this, you can ignore this email.</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
  return { subject, text, html };
}

export function buildProfessionalNewRequestEmail(opts: {
  professionalName: string;
  patientName: string;
  appointmentIso: string;
  reason: string;
  isNewPatient: boolean;
  clinic: EmailClinic;
  reviewUrl: string;
}): BuiltEmail {
  const { date, time } = whenLabels(opts.appointmentIso);
  const pro = professionalFirstName(opts.professionalName);
  const visit = opts.isNewPatient ? "First visit with you" : "Returning patient";

  const subject = `New appointment request: ${opts.patientName}`;
  const text =
    `Hi ${pro},\n\n` +
    `You have a new appointment request from ${opts.patientName} for ${date} at ${time} (Cyprus time).\n\n` +
    `Clinic: ${clinicText(opts.clinic)}\n` +
    `${visit}\n` +
    `Reason: ${opts.reason}\n\n` +
    `Review it in DocCy (accept, decline or suggest other times):\n${opts.reviewUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">New appointment request</h2>
    <p style="${P}">Hi ${escapeHtml(pro)},</p>
    <p style="${P}">
      You have a new request from <strong>${escapeHtml(opts.patientName)}</strong> for
      <strong>${escapeHtml(date)}</strong> at <strong>${escapeHtml(time)}</strong> (Cyprus time).
    </p>
    <p style="${P}"><strong>Clinic:</strong> ${escapeHtml(clinicText(opts.clinic))}<br />${escapeHtml(visit)}</p>
    <p style="${P}"><strong>Reason:</strong> ${escapeHtml(opts.reason)}</p>
    <a href="${escapeHtml(opts.reviewUrl)}" style="${EMAIL_PRIMARY_BTN}">Review the request</a>
    <p style="${MUTED}">If the button does not work, copy this link: ${escapeHtml(opts.reviewUrl)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
  return { subject, text, html };
}

/** RESEND_TO_OVERRIDE redirects every email outside production. */
export function emailRecipient(to: string | null | undefined): string | null {
  const override = process.env.RESEND_TO_OVERRIDE?.trim();
  if (override && process.env.NODE_ENV !== "production") return override;
  const address = String(to ?? "").trim();
  return address || null;
}

export async function sendBuiltEmail(to: string | null | undefined, email: BuiltEmail): Promise<void> {
  const recipient = emailRecipient(to);
  // Test domains (@integration.test, …) never reach Resend.
  if (!recipient || isUndeliverableTestEmail(recipient)) return;
  await sendResendEmail({ to: recipient, subject: email.subject, text: email.text, html: email.html });
}
