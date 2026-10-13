import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import type { EmailClinic } from "@/lib/booking-request-emails";
import { patientClinicBlockHtml, patientClinicBlockText } from "@/lib/patient-email-clinic";
import {
  EMAIL_HEADING,
  EMAIL_PRIMARY_BTN,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_TEXT_MUTED,
} from "@/lib/email-brand";
import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";

const PRIMARY_BTN = EMAIL_PRIMARY_BTN;

/**
 * Email to the patient with the times the professional proposed for their request
 * (1 to 3) and the link to pick one or decline them, before `proposalExpiresAtIso`
 * (user, 2026-10-04: no ping-pong, so there is no "ask for another time").
 */
export type RescheduleProposalEmailInput = {
  patientName: string;
  /** /booking/choose?token=… (appointment_links, purpose "proposal"). */
  chooseUrl: string;
  proposalExpiresAtIso: string;
  doctorName: string;
  slotLabelsCyprus: string[];
  /** Where the proposed times are: name, address (linked to its Maps pin) and the clinic phone. */
  clinic?: (EmailClinic & { phone?: string | null }) | null;
  /** The clinic the patient asked for, when the times are at another one (user, 2026-10-07). */
  requestedClinicName?: string | null;
};

export async function sendPatientRescheduleProposalEmail(
  opts: RescheduleProposalEmailInput & { patientEmail: string; resendToOverride?: string | null },
): Promise<void> {
  const content = buildPatientRescheduleProposalEmailContent(opts);
  const patientEmailTo = String(opts.patientEmail).trim();
  const recipient =
    opts.resendToOverride && process.env.NODE_ENV !== "production" ? opts.resendToOverride : patientEmailTo;
  if (!recipient || isUndeliverableTestEmail(recipient)) return;

  await sendResendEmail({ to: recipient, subject: content.subject, text: content.text, html: content.html });
}

export function buildPatientRescheduleProposalEmailContent(
  opts: RescheduleProposalEmailInput,
): { subject: string; text: string; html: string } {
  const { patientName, chooseUrl, proposalExpiresAtIso, doctorName, slotLabelsCyprus, clinic } = opts;
  const movedFrom = clinic ? String(opts.requestedClinicName ?? "").trim() || null : null;

  const doctorFullName = String(doctorName ?? "").trim() || "your professional";
  const one = slotLabelsCyprus.length === 1;
  const expiryLabel = format(appointmentToCyprusDate(proposalExpiresAtIso), "EEEE, d MMMM yyyy 'at' HH:mm", {
    locale: enUS,
  });

  const intro = one
    ? `${doctorFullName} can't see you at the time you asked for and has reserved this time for you instead.`
    : `${doctorFullName} can't see you at the time you asked for and has reserved these times for you instead.`;
  const action = one
    ? `Confirm this time before ${expiryLabel} (Cyprus time), or decline it.`
    : `Choose one before ${expiryLabel} (Cyprus time), or decline them.`;
  const slotsText = slotLabelsCyprus.map((s) => `• ${s}`).join("\n");
  // Another clinic than the one the patient asked for: said up front, not left to the address.
  const movedText = movedFrom
    ? `At a different clinic: ${one ? "this time is" : "these times are"} at ${clinic!.name}, not at ${movedFrom} where you asked to be seen.`
    : "";
  const movedHtml = movedFrom
    ? `<div style="margin:0 0 14px;padding:12px 13px;border:2px solid #f59e0b;background:rgba(245,158,11,.16);border-radius:12px;">
      <p style="margin:0 0 4px;font-size:12px;line-height:1.35;color:#fbbf24;font-weight:800;letter-spacing:.04em;text-transform:uppercase;">At a different clinic</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#fde68a;">
        ${one ? "This time is" : "These times are"} at <strong>${escapeHtml(clinic!.name)}</strong>, not at ${escapeHtml(movedFrom)} where you asked to be seen.
      </p>
    </div>`
    : "";
  const clinicText = clinic ? patientClinicBlockText(clinic) : "";
  const clinicBlockHtml = clinic ? patientClinicBlockHtml(clinic) : "";
  const slotsHtml = slotLabelsCyprus
    .map((s) => `<li style="margin:0 0 6px;font-size:15px;line-height:1.5;color:#e2e8f0;">${escapeHtml(s)}</li>`)
    .join("");

  const text =
    `Hi ${patientName.trim()},\n\n` +
    `${intro}\n\n` +
    (movedText ? `${movedText}\n\n` : "") +
    `${slotsText}\n\n` +
    (clinicText ? `${clinicText}\n` : "") +
    `${action} If you don't answer by then, the ${one ? "time is" : "times are"} released.\n\n` +
    `Open this link to ${one ? "confirm or decline" : "choose a time or decline"}:\n${chooseUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">${one ? "A new time for your visit" : "Choose your appointment time"}</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(patientName.trim())},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">${escapeHtml(intro)}</p>
    ${movedHtml}
    <ul style="margin:12px 0 16px;padding-left:20px;">${slotsHtml}</ul>
    ${clinicBlockHtml}
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:${EMAIL_TEXT_MUTED};">
      ${escapeHtml(action)} If you don't answer by then, the ${one ? "time is" : "times are"} released.
    </p>
    <a href="${escapeHtml(chooseUrl)}" style="${PRIMARY_BTN}">${one ? "Confirm or decline" : "Choose a time"}</a>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
  const subject = movedFrom
    ? `${doctorFullName} suggested new times for your visit, at another clinic`
    : `${doctorFullName} suggested new times for your visit`;
  return { subject, text, html };
}
