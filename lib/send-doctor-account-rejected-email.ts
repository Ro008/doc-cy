import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import { getSupportFormUrl } from "@/lib/site-url";
import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";

const PRIMARY_BTN = EMAIL_PRIMARY_BTN;

export type DoctorRejectionEmailReason = "license" | "specialty";

export function buildDoctorAccountRejectedEmailContent(opts: {
  doctorName: string;
  reason: DoctorRejectionEmailReason;
  siteUrl?: string;
}): { subject: string; text: string; html: string; supportUrl: string } {
  const firstName = opts.doctorName.trim().split(/\s+/)[0] || opts.doctorName.trim() || "there";
  const supportUrl = getSupportFormUrl("application-review", opts.siteUrl);

  const subject = "[DocCy] Your application was not approved";
  const intro =
    opts.reason === "specialty"
      ? "We reviewed the specialty on your application and cannot include it on DocCy at this time. Your account stays closed — we did not proceed with license verification."
      : "We reviewed your DocCy application and could not verify your professional license. Your account stays closed.";
  const appeal =
    opts.reason === "specialty"
      ? "If you think we misunderstood your practice, please write to us through the support form."
      : "If you believe this is a mistake, please write to us through the support form.";

  const text =
    `Hi ${firstName},\n\n` +
    `${intro}\n\n` +
    `${appeal}\n\n` +
    `Support form:\n${supportUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Your application was not approved</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      ${escapeHtml(intro)}
    </p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      ${escapeHtml(appeal)}
    </p>
    <a href="${escapeHtml(supportUrl)}" style="${PRIMARY_BTN}">Open the support form</a>
    <p style="margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">If the button does not work, copy this link: ${escapeHtml(supportUrl)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  return { subject, text, html, supportUrl };
}

/**
 * Notifies a professional that their application was closed.
 * Best-effort: callers should catch/log; rejection must not depend on Resend.
 */
export async function sendDoctorAccountRejectedEmail(opts: {
  doctorEmail: string;
  doctorName: string;
  reason: DoctorRejectionEmailReason;
  siteUrl?: string;
  resendToOverride?: string | null;
}): Promise<void> {
  const doctorEmail = String(opts.doctorEmail).trim();
  const recipient = opts.resendToOverride?.trim() || doctorEmail;
  if (!recipient) {
    console.warn("[DocCy] Doctor application rejected email skipped: no recipient.");
    return;
  }

  const content = buildDoctorAccountRejectedEmailContent({
    doctorName: opts.doctorName,
    reason: opts.reason,
    siteUrl: opts.siteUrl,
  });

  await sendResendEmail({
    to: recipient,
    subject: content.subject,
    text: content.text,
    html: content.html,
    tags: [
      { name: "category", value: "doctor-application-rejected" },
      { name: "reason", value: opts.reason },
    ],
  });
}
