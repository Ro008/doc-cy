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

export type PatientRequestDeclinedEmailInput = {
  siteUrl: string;
  patientName: string;
  doctorName: string;
  doctorSlug: string;
  /** Plain-text reason from the professional (shown in the email). */
  declineReason: string;
  /** The clinic the request was for: name (linked to the profile), address (pin) and phone. */
  clinic?: EmailClinic | null;
};

export function buildPatientRequestDeclinedEmailContent(
  opts: PatientRequestDeclinedEmailInput,
): { subject: string; text: string; html: string } {
  const { siteUrl, patientName, doctorName, doctorSlug, declineReason, clinic } = opts;

  const proFirst = professionalFirstName(doctorName);
  const bookAgainUrl = new URL(
    `/en/${encodeURIComponent(doctorSlug)}`,
    siteUrl,
  ).toString();

  const subject = `${proFirst} could not accept your appointment request`;
  const text =
    `Hi ${patientName.split(/\s+/)[0] ?? patientName},\n\n` +
    `${proFirst} is unable to go ahead with the visit you requested.\n\n` +
    `Their message:\n${declineReason}\n\n` +
    (clinic ? `${patientClinicBlockText(clinic)}\n` : "") +
    `You can submit a new request on their profile:\n${bookAgainUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Update on your request</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(patientName.split(/\s+/)[0] ?? patientName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      <strong>${escapeHtml(proFirst)}</strong> is unable to go ahead with the visit you requested.
    </p>
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_TEXT_MUTED};">Message from the clinic</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};white-space:pre-wrap;">${escapeHtml(declineReason)}</p>
    ${clinic ? patientClinicBlockHtml(clinic) : ""}
    <a href="${escapeHtml(bookAgainUrl)}" style="${PRIMARY_BTN}">Book again on DocCy</a>
    <p style="margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">If the button does not work, copy this link: ${emailFallbackLink(bookAgainUrl)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  return { subject, text, html };
}

/**
 * Notifies the patient that their booking request was declined, with the doctor's reason
 * and a link to book again on the public profile.
 */
export async function sendPatientRequestDeclinedEmail(
  opts: PatientRequestDeclinedEmailInput & { patientEmail: string; resendToOverride?: string | null },
): Promise<void> {
  const patientEmailTo = String(opts.patientEmail).trim();
  const recipient =
    opts.resendToOverride && process.env.NODE_ENV !== "production"
      ? opts.resendToOverride
      : patientEmailTo;
  if (!recipient) return;

  const { subject, text, html } = buildPatientRequestDeclinedEmailContent(opts);
  await sendResendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
}
