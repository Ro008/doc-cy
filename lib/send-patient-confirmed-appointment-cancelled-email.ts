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

const PRIMARY_BTN =
  "display:block;text-align:center;background:#34d399;color:#022c22;text-decoration:none;font-weight:700;padding:14px 16px;border-radius:12px;margin:0 0 12px;font-size:15px;";

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
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">Appointment cancelled</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">Hi ${escapeHtml(patientName.split(/\s+/)[0] ?? patientName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      Your confirmed visit with <strong>${escapeHtml(proFirst)}</strong> on
      <strong>${escapeHtml(whenLabel)}</strong> (Cyprus time) has been cancelled.
    </p>
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Message from the clinic</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e2e8f0;white-space:pre-wrap;">${escapeHtml(cancelReason)}</p>
    <a href="${escapeHtml(bookAgainUrl)}" style="${PRIMARY_BTN}">Book again on DocCy</a>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">If the button does not work, copy this link: ${escapeHtml(bookAgainUrl)}</p>
    ${automatedEmailFooterHtml()}
  </div>
</div>`;

  await sendResendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
}
