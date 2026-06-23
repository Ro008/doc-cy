import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import { professionalFirstName } from "@/lib/professional-name";
import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";

const PRIMARY_BTN = EMAIL_PRIMARY_BTN;

/**
 * Patient had a confirmed visit; the professional cancelled it and must explain why.
 */
export async function sendPatientConfirmedAppointmentCancelledEmail(opts: {
  siteUrl: string;
  patientEmail: string;
  patientName: string;
  doctorName: string;
  doctorSlug: string;
  appointmentDatetimeIso: string;
  cancelReason: string;
  resendToOverride?: string | null;
}): Promise<void> {
  const {
    siteUrl,
    patientEmail,
    patientName,
    doctorName,
    doctorSlug,
    appointmentDatetimeIso,
    cancelReason,
    resendToOverride,
  } = opts;

  const proFirst = professionalFirstName(doctorName);
  const patientEmailTo = String(patientEmail).trim();
  const whenCy = appointmentToCyprusDate(appointmentDatetimeIso);
  const whenLabel = format(whenCy, "EEEE, d MMMM yyyy 'at' HH:mm", {
    locale: enUS,
  });
  const bookAgainUrl = new URL(
    `/en/${encodeURIComponent(doctorSlug)}`,
    siteUrl,
  ).toString();

  const recipient =
    resendToOverride && process.env.NODE_ENV !== "production"
      ? resendToOverride
      : patientEmailTo;
  if (!recipient) return;

  const subject = `Your visit with ${proFirst} has been cancelled`;
  const text =
    `Hi ${patientName.split(/\s+/)[0] ?? patientName},\n\n` +
    `Your confirmed appointment with ${proFirst} on ${whenLabel} (Cyprus time) has been cancelled.\n\n` +
    `Message from the clinic:\n${cancelReason}\n\n` +
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
    <a href="${escapeHtml(bookAgainUrl)}" style="${PRIMARY_BTN}">Book again on DocCy</a>
    <p style="margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">If the button does not work, copy this link: ${escapeHtml(bookAgainUrl)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  await sendResendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
}
