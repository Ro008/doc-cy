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
 * Notifies the patient that their booking request was declined, with the doctor's reason
 * and a link to book again on the public profile.
 */
export async function sendPatientRequestDeclinedEmail(opts: {
  siteUrl: string;
  patientEmail: string;
  patientName: string;
  doctorName: string;
  doctorSlug: string;
  /** Plain-text reason from the professional (shown in the email). */
  declineReason: string;
  resendToOverride?: string | null;
}): Promise<void> {
  const {
    siteUrl,
    patientEmail,
    patientName,
    doctorName,
    doctorSlug,
    declineReason,
    resendToOverride,
  } = opts;

  const proFirst = professionalFirstName(doctorName);
  const patientEmailTo = String(patientEmail).trim();
  const bookAgainUrl = new URL(
    `/en/${encodeURIComponent(doctorSlug)}`,
    siteUrl,
  ).toString();

  const recipient =
    resendToOverride && process.env.NODE_ENV !== "production"
      ? resendToOverride
      : patientEmailTo;
  if (!recipient) return;

  const subject = `${proFirst} could not accept your appointment request`;
  const text =
    `Hi ${patientName.split(/\s+/)[0] ?? patientName},\n\n` +
    `${proFirst} is unable to go ahead with the visit you requested.\n\n` +
    `Their message:\n${declineReason}\n\n` +
    `You can submit a new request on their profile:\n${bookAgainUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">Update on your request</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">Hi ${escapeHtml(patientName.split(/\s+/)[0] ?? patientName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      <strong>${escapeHtml(proFirst)}</strong> is unable to go ahead with the visit you requested.
    </p>
    <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Message from the clinic</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e2e8f0;white-space:pre-wrap;">${escapeHtml(declineReason)}</p>
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
