/**
 * One-off preview: send the month-end digest email to the testing doctor inbox.
 * Usage: node scripts/send-monthly-digest-preview.mjs
 */
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config({ path: process.env.DOC_CY_ENV_FILE?.trim() || ".env.testing.local" });

const doctorEmail = (
  process.env.TEST_USER_EMAIL ??
  process.env.TEST_DOCTOR_EMAIL ??
  ""
).trim();

if (!doctorEmail) {
  console.error("Missing TEST_USER_EMAIL or TEST_DOCTOR_EMAIL in env file.");
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY?.trim();
if (!apiKey) {
  console.error("Missing RESEND_API_KEY in env file.");
  process.exit(1);
}

function professionalFirstName(fullName) {
  const cleaned = String(fullName ?? "")
    .replace(/^(dr\.?|δρ\.?|doctor|doc)\s+/i, "")
    .trim();
  return cleaned.split(/\s+/).filter(Boolean)[0] ?? "there";
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com").replace(
  /\/$/,
  "",
);
const reportUrl = `${siteUrl}/login?next=${encodeURIComponent("/agenda/insights")}`;

const doctorName = "Andreas Nikos";
const firstName = professionalFirstName(doctorName);
const monthLabel = "April 2026";
const hoursLabel = "2.5 hours";
const appointmentsLabel = "3 appointments";

const subject = `Your DocCy summary for ${monthLabel}`;
const text =
  `Hi ${firstName}, in ${monthLabel} DocCy saved your staff ${hoursLabel} of phone calls and secured ${appointmentsLabel} during hours your clinic was closed. See your full report here: ${reportUrl}\n\n` +
  `---\nThis is an automated message. Please do not reply. For support or feedback, please use the links provided in the app.`;

const html = `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">Your ${escapeHtml(monthLabel)} summary</h2>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#e2e8f0;">
      Hi ${escapeHtml(firstName)}, in ${escapeHtml(monthLabel)} DocCy saved your staff <strong>${escapeHtml(hoursLabel)}</strong> of phone calls and secured <strong>${escapeHtml(appointmentsLabel)}</strong> during hours your clinic was closed.
    </p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#e2e8f0;">
      <a href="${reportUrl}" style="color:#6ee7b7;font-weight:600;text-decoration:none;">See your full report here</a>
    </p>
    <p style="margin:28px 0 0;padding-top:18px;border-top:1px solid rgba(148,163,184,.18);font-size:11px;line-height:1.55;color:#64748b;">
      This is an automated message. Please do not reply. For support or feedback, please use the links provided in the app.
    </p>
  </div>
</div>`;

const from = process.env.RESEND_FROM?.trim() || "DocCy <no-reply@mydoccy.com>";
const to = process.env.RESEND_TO_OVERRIDE?.trim() || doctorEmail;

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({
  from,
  to,
  subject,
  text,
  html,
});

if (error) {
  console.error("Resend error:", error);
  process.exit(1);
}

console.log("Preview sent.", { to, subject, id: data?.id });
