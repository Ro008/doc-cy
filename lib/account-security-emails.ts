import {
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
  sendResendEmail,
} from "@/lib/resend";
import {
  EMAIL_HEADING,
  EMAIL_LOGO_URL,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_LINK,
  EMAIL_TEXT_MUTED,
  emailFallbackLink,
} from "@/lib/email-brand";
import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";

/**
 * Security emails about her own account (user, 2026-10-11): confirm a new email, the
 * email was changed, the password was changed. They are allowed next to the three
 * automatic emails professionals get about bookings.
 */

type EmailContent = { subject: string; text: string; html: string };

function shell(heading: string, bodyHtml: string): string {
  return `
${EMAIL_SHELL_OPEN}
    <img src="${EMAIL_LOGO_URL}" alt="DocCy" width="99" height="30" style="display:block;margin:0 0 16px;height:30px;width:auto;border:0;" />
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">${escapeHtml(heading)}</h2>
    ${bodyHtml}
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
}

function paragraph(html: string, muted = false): string {
  return `<p style="margin:0 0 10px;font-size:${muted ? 13 : 15}px;line-height:1.6;color:${muted ? EMAIL_TEXT_MUTED : EMAIL_TEXT};">${html}</p>`;
}

/** To the NEW address: nothing changes until the link is opened and confirmed. */
export function buildEmailChangeConfirmEmail(opts: { confirmUrl: string; minutes: number }): EmailContent {
  const confirmUrl = opts.confirmUrl.trim();
  const subject = "[DocCy] Confirm your new email";
  const text =
    `Confirm your new email\n\n` +
    `You asked to use this address for your DocCy account. Once you confirm it, booking requests are sent here, and you are signed out on all devices to sign in again with this address.\n\n` +
    `This link lasts ${opts.minutes} minutes and works once:\n${confirmUrl}\n\n` +
    `If you did not ask for this, ignore this email. Nothing changes.\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const html = shell(
    "Confirm your new email",
    paragraph(
      "You asked to use this address for your DocCy account. Once you confirm it, booking requests are sent here, and you are signed out on all devices to sign in again with this address.",
    ) +
      `<a href="${escapeHtml(confirmUrl)}" style="${EMAIL_PRIMARY_BTN}">Confirm new email</a>` +
      paragraph(
        `This link lasts ${opts.minutes} minutes and works once. If you did not ask for this, ignore this email. Nothing changes.`,
        true,
      ) +
      paragraph(`If the button does not work, copy this link: ${emailFallbackLink(confirmUrl)}`, true),
  );
  return { subject, text, html };
}

/** To the OLD address, after the change: so a change she did not make is noticed. */
export function buildEmailChangedNoticeEmail(opts: { newEmail: string; siteUrl: string }): EmailContent {
  const newEmail = opts.newEmail.trim();
  const siteUrl = opts.siteUrl.replace(/\/+$/, "");
  const subject = "[DocCy] Your email was changed";
  const text =
    `Your DocCy email was changed\n\n` +
    `Your DocCy account now uses ${newEmail}. From now on you sign in with it, and booking requests are sent there, not to this address.\n\n` +
    `If this was not you, contact DocCy at once through the support form on ${siteUrl}.\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const html = shell(
    "Your DocCy email was changed",
    paragraph(
      `Your DocCy account now uses <a href="mailto:${escapeHtml(newEmail)}" style="${EMAIL_TEXT_LINK}">${escapeHtml(newEmail)}</a>. From now on you sign in with it, and booking requests are sent there, not to this address.`,
    ) +
      paragraph(
        `If this was not you, contact DocCy at once through the support form on <a href="${escapeHtml(siteUrl)}" style="${EMAIL_TEXT_LINK}">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a>.`,
        true,
      ),
  );
  return { subject, text, html };
}

/** After a new password: her other devices were signed out. */
export function buildPasswordChangedNoticeEmail(opts: { siteUrl: string }): EmailContent {
  const resetUrl = `${opts.siteUrl.replace(/\/+$/, "")}/forgot-password`;
  const subject = "[DocCy] Your password was changed";
  const text =
    `Your DocCy password was changed\n\n` +
    `Your password was just changed, and you were signed out of DocCy on your other devices.\n\n` +
    `If this was not you, set a new password now:\n${resetUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const html = shell(
    "Your DocCy password was changed",
    paragraph("Your password was just changed, and you were signed out of DocCy on your other devices.") +
      paragraph(
        `If this was not you, <a href="${escapeHtml(resetUrl)}" style="${EMAIL_TEXT_LINK}">set a new password now</a>.`,
        true,
      ),
  );
  return { subject, text, html };
}

/** True when sent (or skipped for a test address); false when sending failed. */
export async function sendAccountSecurityEmail(to: string, content: EmailContent): Promise<boolean> {
  const recipient = to.trim();
  if (!recipient || isUndeliverableTestEmail(recipient)) return true;
  try {
    await sendResendEmail({ to: recipient, subject: content.subject, text: content.text, html: content.html });
    return true;
  } catch (error) {
    console.error("[DocCy] account security email failed", { subject: content.subject, error });
    return false;
  }
}
