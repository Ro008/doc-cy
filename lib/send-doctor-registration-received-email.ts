import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";

const DOCCY_EMAIL_LOGO_URL = "https://www.mydoccy.com/brand/doccy-logo.png";

export function buildDoctorRegistrationReceivedEmailContent(opts: {
  doctorName: string;
  confirmUrl?: string | null;
}): { subject: string; text: string; html: string } {
  const firstName = opts.doctorName.trim().split(/\s+/)[0] || opts.doctorName.trim() || "there";
  const confirmUrl = String(opts.confirmUrl ?? "").trim();

  const subject = "[DocCy] We received your application";
  const confirmText = confirmUrl
    ? `Confirm this email with one click (this is a link, not a code):\n${confirmUrl}\n\n`
    : "";
  const confirmHtml = confirmUrl
    ? `<a href="${escapeHtml(confirmUrl)}" style="${EMAIL_PRIMARY_BTN}">Confirm your email</a>
    <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">
      This is a one-click link, not a code. It expires shortly and can only be used once.
    </p>
    <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">If the button does not work, copy this link: ${escapeHtml(confirmUrl)}</p>`
    : "";

  const text =
    `Hi ${firstName},\n\n` +
    `Thanks for applying to DocCy. We have received your application.\n\n` +
    confirmText +
    `After you confirm your email, we will review your credentials. You will get another email when your account is ready to sign in.\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <img src="${DOCCY_EMAIL_LOGO_URL}" alt="DocCy" width="99" height="30" style="display:block;margin:0 0 16px;height:30px;width:auto;border:0;" />
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">We received your application</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      Thanks for applying to DocCy. We have received your application.
    </p>
    ${confirmHtml}
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      After you confirm your email, we will review your credentials. You will get another email when your account is ready to sign in.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">
      If you did not submit an application, you can ignore this message.
    </p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  return { subject, text, html };
}

/**
 * Confirms to the professional that their registration form was received,
 * and asks them to confirm the email with a magic link (not a code).
 * Best-effort: registration must not depend on Resend.
 */
export async function sendDoctorRegistrationReceivedEmail(opts: {
  doctorEmail: string;
  doctorName: string;
  confirmUrl?: string | null;
  resendToOverride?: string | null;
}): Promise<void> {
  const doctorEmail = String(opts.doctorEmail).trim();
  const recipient = opts.resendToOverride?.trim() || doctorEmail;
  if (!recipient) {
    console.warn("[DocCy] Doctor registration received email skipped: no recipient.");
    return;
  }

  const content = buildDoctorRegistrationReceivedEmailContent({
    doctorName: opts.doctorName,
    confirmUrl: opts.confirmUrl,
  });

  await sendResendEmail({
    to: recipient,
    subject: content.subject,
    text: content.text,
    html: content.html,
    tags: [{ name: "category", value: "doctor-registration-received" }],
  });
}
