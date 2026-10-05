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
  emailFallbackLink,
} from "@/lib/email-brand";
import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";

/**
 * The reminder the scheduled job sends while a proposal is waiting for the patient
 * (user, 2026-10-04): once, 3 hours before it lapses (`appointments.proposal_reminder_sent_at`).
 * A lapsed proposal sends nothing else: the request becomes EXPIRED quietly. There is no
 * "ask for another time" (no ping-pong).
 */

/** Send the reminder this many hours before the deadline. */
export const RESCHEDULE_REMINDER_LEAD_HOURS = 3;

export function isRescheduleReminderDue(opts: {
  nowMs: number;
  proposalExpiresAtIso: string | null;
  reminderSentAtIso: string | null;
}): boolean {
  if (opts.reminderSentAtIso) return false;
  const expiresMs = opts.proposalExpiresAtIso ? new Date(opts.proposalExpiresAtIso).getTime() : NaN;
  if (!Number.isFinite(expiresMs) || opts.nowMs >= expiresMs) return false;
  return expiresMs - opts.nowMs <= RESCHEDULE_REMINDER_LEAD_HOURS * 60 * 60 * 1000;
}

export type RescheduleReminderEmailOpts = {
  patientName: string;
  /** The same /booking/choose link as the proposal email. */
  chooseUrl: string;
  proposalExpiresAtIso: string;
  doctorName: string;
  slotLabelsCyprus: string[];
};

type EmailContent = { subject: string; text: string; html: string };

export function buildPatientRescheduleReminderEmailContent(opts: RescheduleReminderEmailOpts): EmailContent {
  const doctor = String(opts.doctorName ?? "").trim() || "your professional";
  const patient = String(opts.patientName ?? "").trim() || "there";
  const deadline = format(appointmentToCyprusDate(opts.proposalExpiresAtIso), "EEEE, d MMMM yyyy 'at' HH:mm", {
    locale: enUS,
  });
  const one = opts.slotLabelsCyprus.length === 1;

  const subject = `Reminder: choose your new time with ${doctor}`;
  const line = `${doctor} is still holding ${one ? "this time" : "these times"} for you. Answer before ${deadline} (Cyprus time), or ${
    one ? "it is" : "they are"
  } released.`;
  const text =
    `Hi ${patient},\n\n` +
    `${line}\n\n` +
    `${opts.slotLabelsCyprus.map((s) => `• ${s}`).join("\n")}\n\n` +
    `Choose a time or decline:\n${opts.chooseUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const slotsHtml = opts.slotLabelsCyprus
    .map((s) => `<li style="margin:0 0 6px;font-size:15px;line-height:1.5;color:${EMAIL_TEXT};">${escapeHtml(s)}</li>`)
    .join("");
  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">Choose your new time</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(patient)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">${escapeHtml(line)}</p>
    <ul style="margin:12px 0 16px;padding-left:20px;">${slotsHtml}</ul>
    <a href="${escapeHtml(opts.chooseUrl)}" style="${EMAIL_PRIMARY_BTN}">Choose a time</a>
    <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">If the button does not work, copy this link: ${emailFallbackLink(opts.chooseUrl)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
  return { subject, text, html };
}

export async function sendPatientRescheduleReminderEmail(
  opts: RescheduleReminderEmailOpts & { patientEmail: string },
): Promise<void> {
  const override = process.env.RESEND_TO_OVERRIDE?.trim();
  const recipient = override && process.env.NODE_ENV !== "production" ? override : String(opts.patientEmail).trim();
  if (!recipient || isUndeliverableTestEmail(recipient)) return;
  const content = buildPatientRescheduleReminderEmailContent(opts);
  await sendResendEmail({ to: recipient, subject: content.subject, text: content.text, html: content.html });
}
