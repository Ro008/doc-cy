import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
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

const PRIMARY_BTN = EMAIL_PRIMARY_BTN;

/**
 * Email to patient with link to pick one of the proposed slots before `proposalExpiresAtIso`.
 * Intentionally no WhatsApp — keep rescheduling inside DocCy until confirmed.
 */
export async function sendPatientRescheduleProposalEmail(opts: {
  siteUrl: string;
  patientEmail: string;
  patientName: string;
  appointmentId: string;
  rescheduleToken: string;
  proposalExpiresAtIso: string;
  doctorName: string;
  slotLabelsCyprus: string[];
  rescheduleReason?: string | null;
  isFromConfirmedReschedule?: boolean;
  resendToOverride?: string | null;
}): Promise<void> {
  const content = buildPatientRescheduleProposalEmailContent(opts);
  const patientEmailTo = String(opts.patientEmail).trim();
  const recipient =
    opts.resendToOverride && process.env.NODE_ENV !== "production"
      ? opts.resendToOverride
      : patientEmailTo;
  if (!recipient) return;

  await sendResendEmail({
    to: recipient,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

export function buildPatientRescheduleProposalEmailContent(opts: {
  siteUrl: string;
  patientEmail: string;
  patientName: string;
  appointmentId: string;
  rescheduleToken: string;
  proposalExpiresAtIso: string;
  doctorName: string;
  slotLabelsCyprus: string[];
  rescheduleReason?: string | null;
  isFromConfirmedReschedule?: boolean;
  resendToOverride?: string | null;
}): { subject: string; text: string; html: string } {
  const {
    siteUrl,
    patientName,
    appointmentId,
    rescheduleToken,
    proposalExpiresAtIso,
    doctorName,
    slotLabelsCyprus,
    rescheduleReason,
    isFromConfirmedReschedule,
  } = opts;

  const doctorFullName = String(doctorName ?? "").trim() || "your professional";
  const pickUrl = new URL(
    `/reschedule/${encodeURIComponent(appointmentId)}?token=${encodeURIComponent(rescheduleToken)}`,
    siteUrl
  ).toString();

  const expCy = appointmentToCyprusDate(proposalExpiresAtIso);
  const expiryLabel = format(expCy, "EEEE, d MMMM yyyy 'at' HH:mm", {
    locale: enUS,
  });

  const slotsText = slotLabelsCyprus.map((s) => `• ${s}`).join("\n");
  const reasonText = String(rescheduleReason ?? "").trim();
  const reasonBlockText = reasonText
    ? `\nReason from ${doctorFullName}: ${reasonText}\n`
    : "";
  const calendarCleanupText = isFromConfirmedReschedule
    ? `\nImportant: if you already added the previous confirmed visit to your calendar, please remove that old calendar entry after you pick your new time.\n`
    : "";
  const slotsHtml = slotLabelsCyprus
    .map(
      (s) =>
        `<li style="margin:0 0 6px;font-size:15px;line-height:1.5;color:#e2e8f0;">${escapeHtml(s)}</li>`
    )
    .join("");
  const reasonBlockHtml = reasonText
    ? `<div style="margin:8px 0 10px;padding:10px 12px;border:1px solid rgba(251,191,36,.35);background:rgba(251,191,36,.08);border-radius:10px;">
      <p style="margin:0 0 4px;font-size:12px;line-height:1.4;color:#fbbf24;font-weight:600;">Reason from ${escapeHtml(doctorFullName)}</p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#fde68a;white-space:pre-wrap;">${escapeHtml(reasonText)}</p>
    </div>`
    : "";
  const calendarCleanupHtml = isFromConfirmedReschedule
    ? `<p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#fcd34d;">
      <strong>Important:</strong> if you already added the previous confirmed visit to your calendar, please remove that old entry after you choose your new time.
    </p>`
    : "";

  const text =
    `Hi ${patientName.trim()},\n\n` +
    `${doctorFullName} has reserved these times for you. Choose one before ${expiryLabel} (Cyprus time) to confirm your visit. ` +
    `(That deadline is whichever comes first: 24 hours from when this was sent, or 2 hours before the first suggested time.)\n\n` +
    `${reasonBlockText}` +
    `${calendarCleanupText}` +
    `${slotsText}\n\n` +
    `Open this link to pick a time:\n${pickUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Choose your appointment time</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(patientName.trim())},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      <strong>${escapeHtml(doctorFullName)}</strong> has reserved these times for you. Pick one before
      <strong>${escapeHtml(expiryLabel)}</strong> (Cyprus time) to confirm your visit.
    </p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:${EMAIL_TEXT_MUTED};">
      That deadline is whichever comes first: 24 hours from when this was sent, or 2 hours before the first suggested time.
    </p>
    ${reasonBlockHtml}
    ${calendarCleanupHtml}
    <ul style="margin:12px 0 16px;padding-left:20px;">${slotsHtml}</ul>
    <a href="${pickUrl}" style="${PRIMARY_BTN}">Choose a time</a>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
  return {
    subject: `${doctorFullName} suggested new times for your visit`,
    text,
    html,
  };
}
