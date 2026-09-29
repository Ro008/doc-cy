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
import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";

/** Hosted logo so Gmail can load it even when the sign-in started on localhost. */
const DOCCY_EMAIL_LOGO_URL = "https://www.mydoccy.com/brand/doccy-logo.png";

/** Second sign-in step for professionals: the link, and its code for another device. */
export function buildSignInLinkEmailContent(opts: { signInUrl: string; code: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const signInUrl = opts.signInUrl.trim();
  const code = opts.code.trim();
  const subject = "[DocCy] Your sign-in link";
  const text =
    `Sign in to DocCy\n\n` +
    `Open this link to finish signing in:\n${signInUrl}\n\n` +
    `Or enter this code on the sign-in page: ${code}\n\n` +
    `The link and the code last 1 hour and work once.\n\n` +
    `If you didn't try to sign in, someone may know your password: change your password.\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <img src="${DOCCY_EMAIL_LOGO_URL}" alt="DocCy" width="99" height="30" style="display:block;margin:0 0 16px;height:30px;width:auto;border:0;" />
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Sign in to DocCy</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      Open this link to finish signing in.
    </p>
    <a href="${escapeHtml(signInUrl)}" style="${EMAIL_PRIMARY_BTN}">Sign in</a>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      Or enter this code on the sign-in page:
      <strong style="font-size:20px;letter-spacing:0.15em;">${escapeHtml(code)}</strong>
    </p>
    <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">
      The link and the code last 1 hour and work once. If you didn't try to sign in, someone may know your password: change your password.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">If the button does not work, copy this link: ${escapeHtml(signInUrl)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  return { subject, text, html };
}

/**
 * Throws when the email can't be sent (the caller tells her to try again).
 * `undeliverable`: a test-only address no inbox receives, never sent (tests fetch
 * their own link from Supabase).
 */
export async function sendSignInLinkEmail(opts: {
  to: string;
  signInUrl: string;
  code: string;
}): Promise<{ skipped: boolean; undeliverable?: true }> {
  if (isUndeliverableTestEmail(opts.to)) return { skipped: true, undeliverable: true };
  const content = buildSignInLinkEmailContent(opts);
  const result = await sendResendEmail({
    to: opts.to.trim(),
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  return { skipped: Boolean(result && "skipped" in result && result.skipped) };
}
