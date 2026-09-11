import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import { getDoctorLoginUrl } from "@/lib/site-url";
import { DOCTOR_FIRST_LOGIN_PATH } from "@/lib/first-login-trial-notice";
import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";

const PRIMARY_BTN = EMAIL_PRIMARY_BTN;

/** Same path as first verified login redirect (`/agenda/settings`). */
export const DOCTOR_POST_VERIFICATION_PATH = DOCTOR_FIRST_LOGIN_PATH;

export function buildDoctorAccountVerifiedEmailContent(opts: {
  siteUrl: string;
  doctorName: string;
}): { subject: string; text: string; html: string; loginUrl: string } {
  const firstName = opts.doctorName.trim().split(/\s+/)[0] || opts.doctorName.trim() || "there";
  const loginUrl = getDoctorLoginUrl(DOCTOR_FIRST_LOGIN_PATH, opts.siteUrl);

  const subject = "[DocCy] Your account is ready — sign in";
  const text =
    `Hi ${firstName},\n\n` +
    `Your DocCy profile has been verified. Sign in with the email and password you used when registering.\n\n` +
    `Sign in:\n${loginUrl}\n\n` +
    `After you sign in you will land on Settings to review your public profile, working hours, and appointment types.\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Your account is ready</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      Your DocCy profile has been verified. Sign in with the email and password you used when registering.
    </p>
    <a href="${escapeHtml(loginUrl)}" style="${PRIMARY_BTN}">Sign in to DocCy</a>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:${EMAIL_TEXT_MUTED};">
      After you sign in you will land on Settings to review your public profile, working hours, and appointment types.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">If the button does not work, copy this link: ${escapeHtml(loginUrl)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  return { subject, text, html, loginUrl };
}

/**
 * Notifies a professional that their account was verified and they can sign in.
 * Best-effort: callers should catch/log; verification must not depend on Resend.
 */
export async function sendDoctorAccountVerifiedEmail(opts: {
  siteUrl: string;
  doctorEmail: string;
  doctorName: string;
  resendToOverride?: string | null;
}): Promise<void> {
  const doctorEmail = String(opts.doctorEmail).trim();
  const recipient = opts.resendToOverride?.trim() || doctorEmail;
  if (!recipient) {
    console.warn("[DocCy] Doctor account verified email skipped: no recipient.");
    return;
  }

  const content = buildDoctorAccountVerifiedEmailContent({
    siteUrl: opts.siteUrl,
    doctorName: opts.doctorName,
  });

  await sendResendEmail({
    to: recipient,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
