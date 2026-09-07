import {
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
  sendResendEmail,
} from "@/lib/resend";
import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";

/** Hosted logo so Gmail can load it even when the reset was requested on localhost. */
const DOCCY_EMAIL_LOGO_URL = "https://www.mydoccy.com/brand/doccy-logo.png";

export function buildPasswordResetEmailContent(opts: { resetUrl: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const resetUrl = opts.resetUrl.trim();
  const subject = "[DocCy] Reset your password";
  const text =
    `Reset your DocCy password\n\n` +
    `We received a request to choose a new password for your DocCy practitioner account.\n\n` +
    `This link expires shortly and can only be used once:\n${resetUrl}\n\n` +
    `If you did not ask for a new password, you can ignore this email. Your current password stays the same.\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <img src="${DOCCY_EMAIL_LOGO_URL}" alt="DocCy" width="99" height="30" style="display:block;margin:0 0 16px;height:30px;width:auto;border:0;" />
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Reset your DocCy password</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      We received a request to choose a new password for your DocCy practitioner account.
    </p>
    <a href="${escapeHtml(resetUrl)}" style="${EMAIL_PRIMARY_BTN}">Choose a new password</a>
    <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">
      This link expires shortly and can only be used once. If you did not ask for a new password, ignore this email — your current password stays the same.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">If the button does not work, copy this link: ${escapeHtml(resetUrl)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  return { subject, text, html };
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const to = opts.to.trim();
  if (!to) {
    console.warn("[DocCy] Password reset email skipped: no recipient.");
    return;
  }
  const content = buildPasswordResetEmailContent({ resetUrl: opts.resetUrl });
  const result = await sendResendEmail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  if (result && "skipped" in result && result.skipped) {
    throw new Error("Resend skipped");
  }
}
