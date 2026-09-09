import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import {
  EMAIL_HEADING,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";

export function buildDoctorRegistrationReceivedEmailContent(opts: {
  doctorName: string;
}): { subject: string; text: string; html: string } {
  const firstName = opts.doctorName.trim().split(/\s+/)[0] || opts.doctorName.trim() || "there";

  const subject = "[DocCy] We received your application";
  const text =
    `Hi ${firstName},\n\n` +
    `Thanks for applying to DocCy. We have received your application and will review it shortly.\n\n` +
    `You will get another email when your account is ready to sign in. Until then, you do not need to do anything.\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">We received your application</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      Thanks for applying to DocCy. We have received your application and will review it shortly.
    </p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      You will get another email when your account is ready to sign in. Until then, you do not need to do anything.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">
      If you did not submit an application, you can ignore this message.
    </p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  return { subject, text, html };
}

/**
 * Confirms to the professional that their registration form was received.
 * Best-effort: registration must not depend on Resend.
 */
export async function sendDoctorRegistrationReceivedEmail(opts: {
  doctorEmail: string;
  doctorName: string;
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
  });

  await sendResendEmail({
    to: recipient,
    subject: content.subject,
    text: content.text,
    html: content.html,
    tags: [{ name: "category", value: "doctor-registration-received" }],
  });
}
