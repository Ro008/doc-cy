import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
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
  resendToOverride?: string | null;
}): Promise<void> {
  const {
    siteUrl,
    patientEmail,
    patientName,
    appointmentId,
    rescheduleToken,
    proposalExpiresAtIso,
    doctorName,
    slotLabelsCyprus,
    resendToOverride,
  } = opts;

  const proFirst = professionalFirstName(doctorName);
  const patientEmailTo = String(patientEmail).trim();
  const pickUrl = new URL(
    `/reschedule/${encodeURIComponent(appointmentId)}?token=${encodeURIComponent(rescheduleToken)}`,
    siteUrl
  ).toString();

  const expCy = appointmentToCyprusDate(proposalExpiresAtIso);
  const expiryLabel = format(expCy, "EEEE, d MMMM yyyy 'at' HH:mm", {
    locale: enUS,
  });

  const slotsText = slotLabelsCyprus.map((s) => `• ${s}`).join("\n");
  const slotsHtml = slotLabelsCyprus
    .map(
      (s) =>
        `<li style="margin:0 0 6px;font-size:15px;line-height:1.5;color:#e2e8f0;">${escapeHtml(s)}</li>`
    )
    .join("");

  const text =
    `Hi ${patientName.trim()},\n\n` +
    `${proFirst} has reserved these times for you. Choose one before ${expiryLabel} (Cyprus time) to confirm your visit. ` +
    `(That deadline is whichever comes first: 24 hours from when this was sent, or 2 hours before the first suggested time.)\n\n` +
    `${slotsText}\n\n` +
    `Open this link to pick a time:\n${pickUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">Choose your appointment time</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">Hi ${escapeHtml(patientName.trim())},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      <strong>${escapeHtml(proFirst)}</strong> has reserved these times for you. Pick one before
      <strong>${escapeHtml(expiryLabel)}</strong> (Cyprus time) to confirm your visit.
    </p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#94a3b8;">
      That deadline is whichever comes first: 24 hours from when this was sent, or 2 hours before the first suggested time.
    </p>
    <ul style="margin:12px 0 16px;padding-left:20px;">${slotsHtml}</ul>
    <a href="${pickUrl}" style="${PRIMARY_BTN}">Choose a time</a>
    ${automatedEmailFooterHtml()}
  </div>
</div>`;

  const recipient =
    resendToOverride && process.env.NODE_ENV !== "production"
      ? resendToOverride
      : patientEmailTo;
  if (!recipient) return;

  await sendResendEmail({
    to: recipient,
    subject: `${proFirst} suggested new times for your visit`,
    text,
    html,
  });
}
