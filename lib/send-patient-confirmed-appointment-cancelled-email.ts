import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import type { EmailClinic } from "@/lib/booking-request-emails";
import { patientClinicBlockHtml, patientClinicBlockText } from "@/lib/patient-email-clinic";
import { professionalFirstName } from "@/lib/professional-name";
import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
  emailFallbackLink,
} from "@/lib/email-brand";

const PRIMARY_BTN = EMAIL_PRIMARY_BTN;

export type PatientConfirmedCancelledEmailInput = {
  siteUrl: string;
  patientName: string;
  doctorName: string;
  doctorSlug: string;
  appointmentDatetimeIso: string;
  cancelReason: string;
  /** Where the visit was: name (linked to the profile), address (pin) and phone. */
  clinic?: EmailClinic | null;
};

export function buildPatientConfirmedAppointmentCancelledEmailContent(
  opts: PatientConfirmedCancelledEmailInput,
): { subject: string; text: string; html: string } {
  const { siteUrl, patientName, doctorName, doctorSlug, appointmentDatetimeIso, cancelReason, clinic } = opts;

  const proFirst = professionalFirstName(doctorName);
  const whenCy = appointmentToCyprusDate(appointmentDatetimeIso);
  const whenLabel = format(whenCy, "EEEE, d MMMM yyyy 'at' HH:mm", {
    locale: enUS,
  });
  const bookAgainUrl = new URL(
    `/en/${encodeURIComponent(doctorSlug)}`,
    siteUrl,
  ).toString();

  const subject = `Your visit with ${proFirst} has been cancelled`;
  const text =
    `Hi ${patientName.split(/\s+/)[0] ?? patientName},\n\n` +
    `Your confirmed appointment with ${proFirst} on ${whenLabel} (Cyprus time) has been cancelled.\n\n` +
    `Message from the clinic:\n${cancelReason}\n\n` +
    (clinic ? `${patientClinicBlockText(clinic)}\n` : "") +
    `You can book a new time on their profile:\n${bookAgainUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Appointment cancelled</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(patientName.split(/\s+/)[0] ?? patientName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      Your confirmed visit with <strong>${escapeHtml(proFirst)}</strong> on
      <strong>${escapeHtml(whenLabel)}</strong> (Cyprus time) has been cancelled.
    </p>
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_TEXT_MUTED};">Message from the clinic</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};white-space:pre-wrap;">${escapeHtml(cancelReason)}</p>
    ${clinic ? patientClinicBlockHtml(clinic) : ""}
    <a href="${escapeHtml(bookAgainUrl)}" style="${PRIMARY_BTN}">Book again on DocCy</a>
    <p style="margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">If the button does not work, copy this link: ${emailFallbackLink(bookAgainUrl)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  return { subject, text, html };
}

/**
 * Patient had a confirmed visit; the professional cancelled it and must explain why.
 */
export async function sendPatientConfirmedAppointmentCancelledEmail(
  opts: PatientConfirmedCancelledEmailInput & { patientEmail: string; resendToOverride?: string | null },
): Promise<void> {
  const patientEmailTo = String(opts.patientEmail).trim();
  const recipient =
    opts.resendToOverride && process.env.NODE_ENV !== "production"
      ? opts.resendToOverride
      : patientEmailTo;
  if (!recipient) return;

  const { subject, text, html } = buildPatientConfirmedAppointmentCancelledEmailContent(opts);
  await sendResendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
}
