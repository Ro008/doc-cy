import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import { professionalFirstName } from "@/lib/professional-name";
import { getDoctorLoginUrl } from "@/lib/site-url";
import type { MonthlyDigestMetrics } from "@/lib/monthly-digest-metrics";
import {
  EMAIL_HEADING,
  EMAIL_LINK_ACCENT,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
} from "@/lib/email-brand";

export type DoctorMonthlyDigestEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function formatHoursForEmail(hours: number): string {
  if (hours <= 0) return "0 hours";
  if (hours >= 1) {
    const rounded = Math.round(hours * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} hours` : `${rounded} hours`;
  }
  const minutes = Math.round(hours * 60);
  return minutes <= 1 ? "1 minute" : `${minutes} minutes`;
}

function formatAppointmentCount(count: number): string {
  if (count === 1) return "1 appointment";
  return `${count} appointments`;
}

export function buildDoctorMonthlyDigestEmailContent(opts: {
  siteUrl: string;
  doctorName: string;
  metrics: MonthlyDigestMetrics;
}): DoctorMonthlyDigestEmailContent {
  const firstName = professionalFirstName(opts.doctorName);
  const hoursLabel = formatHoursForEmail(opts.metrics.phoneTimeSavedHours);
  const appointmentsLabel = formatAppointmentCount(opts.metrics.closedHoursAppointmentsCount);
  const reportUrl = getDoctorLoginUrl("/agenda/insights", opts.siteUrl);

  const body =
    `Hi ${firstName}, in ${opts.metrics.monthLabel} DocCy saved your staff ${hoursLabel} of phone calls and secured ${appointmentsLabel} during hours your clinic was closed. See your full report here: ${reportUrl}`;

  const subject = `Your DocCy summary for ${opts.metrics.monthLabel}`;

  const text = `${body}\n\n---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Your ${escapeHtml(opts.metrics.monthLabel)} summary</h2>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${EMAIL_TEXT};">
      Hi ${escapeHtml(firstName)}, in ${escapeHtml(opts.metrics.monthLabel)} DocCy saved your staff <strong>${escapeHtml(hoursLabel)}</strong> of phone calls and secured <strong>${escapeHtml(appointmentsLabel)}</strong> during hours your clinic was closed.
    </p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${EMAIL_TEXT};">
      <a href="${reportUrl}" style="${EMAIL_LINK_ACCENT}">See your full report here</a>
    </p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  return { subject, text, html };
}

export async function sendDoctorMonthlyDigestEmail(opts: {
  siteUrl: string;
  doctorEmail: string;
  doctorName: string;
  metrics: MonthlyDigestMetrics;
  resendToOverride?: string | null;
}): Promise<void> {
  const doctorEmail = String(opts.doctorEmail).trim();
  if (!doctorEmail) return;

  const content = buildDoctorMonthlyDigestEmailContent({
    siteUrl: opts.siteUrl,
    doctorName: opts.doctorName,
    metrics: opts.metrics,
  });

  await sendResendEmail({
    to: opts.resendToOverride || doctorEmail,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
