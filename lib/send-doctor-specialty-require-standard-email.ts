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
 * Notifies the professional that their custom specialty was not added to the directory
 * and they must choose a standard category in settings.
 */
export async function sendDoctorSpecialtyRequireStandardEmail(opts: {
  siteUrl: string;
  doctorEmail: string;
  doctorName: string;
  submittedSpecialty: string;
  founderMessage?: string | null;
  resendToOverride?: string | null;
}): Promise<void> {
  const {
    siteUrl,
    doctorEmail,
    doctorName,
    submittedSpecialty,
    founderMessage,
    resendToOverride,
  } = opts;

  const first = professionalFirstName(doctorName);
  const settingsUrl = new URL("/agenda/settings", siteUrl).toString();
  const recipient =
    resendToOverride && process.env.NODE_ENV !== "production"
      ? resendToOverride
      : String(doctorEmail).trim();
  if (!recipient) return;

  const submitted = submittedSpecialty.trim() || "your custom specialty";
  const extra =
    founderMessage && founderMessage.trim()
      ? `\n\nNote from DocCy:\n${founderMessage.trim()}\n`
      : "";

  const subject = "Please choose a standard specialty on DocCy";
  const text =
    `Hi ${first},\n\n` +
    `We could not add "${submitted}" as a new category in the DocCy directory.\n\n` +
    `Please open your profile settings and select one of the standard specialties from the list. ` +
    `Patients find you more easily when your profile uses a standard category.\n` +
    extra +
    `\nOpen settings:\n${settingsUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const extraHtml =
    founderMessage && founderMessage.trim()
      ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e2e8f0;white-space:pre-wrap;"><strong>Note from DocCy:</strong><br/>${escapeHtml(founderMessage.trim())}</p>`
      : "";

  const html = `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">Choose a standard specialty</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">Hi ${escapeHtml(first)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      We could not add <strong>${escapeHtml(submitted)}</strong> as a new category in the DocCy directory.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      Please open your profile settings and select one of the <strong>standard specialties</strong> from the list.
    </p>
    ${extraHtml}
    <a href="${escapeHtml(settingsUrl)}" style="${PRIMARY_BTN}">Open profile settings</a>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">If the button does not work, copy this link: ${escapeHtml(settingsUrl)}</p>
    ${automatedEmailFooterHtml()}
  </div>
</div>`;

  await sendResendEmail({ to: recipient, subject, text, html });
}
