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
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";

/**
 * Emails for the reschedule follow-up (copy and layout are frontend; sending is backend).
 *
 * CONTRACT for the backend (Livio) — a scheduled job (e.g. every 15 min) over NEEDS_RESCHEDULE rows:
 * 1. Reminder: when isRescheduleReminderDue(...) → sendPatientRescheduleReminderEmail(...) and store
 *    appointments.reschedule_reminder_sent_at (new column, timestamptz). Reset it on each new proposal.
 * 2. Expiry: when proposal_expires_at <= now → status RESCHEDULE_EXPIRED (frees the held times) and
 *    sendPatientRescheduleExpiredEmail(...). No doctor email: it shows up in the dashboard.
 * 3. POST /api/reschedule/[id]/request-other-time (lib/reschedule-other-times.ts) →
 *    sendDoctorPatientAskedOtherTimeEmail(...) after updating the row.
 * All times are shown in Cyprus time. Online booking first: never point the patient at a phone call.
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

function cyprusLongLabel(iso: string): string {
  return format(appointmentToCyprusDate(iso), "EEEE, d MMMM yyyy 'at' HH:mm", { locale: enUS });
}

function nameOr(raw: string | null | undefined, fallback: string): string {
  return String(raw ?? "").trim() || fallback;
}

type EmailContent = { subject: string; text: string; html: string };

function paragraph(html: string, muted = false): string {
  return `<p style="margin:0 0 10px;font-size:${muted ? 14 : 15}px;line-height:1.6;color:${muted ? EMAIL_TEXT_MUTED : EMAIL_TEXT};">${html}</p>`;
}

function shell(title: string, body: string, cta: { href: string; label: string }): string {
  return `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">${escapeHtml(title)}</h2>
    ${body}
    <a href="${cta.href}" style="${EMAIL_PRIMARY_BTN}">${escapeHtml(cta.label)}</a>
    <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:${EMAIL_TEXT_MUTED};">If the button does not work, copy this link: ${escapeHtml(cta.href)}</p>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;
}

// ---------------------------------------------------------------- reminder (patient)

export type RescheduleReminderEmailOpts = {
  siteUrl: string;
  patientName: string;
  appointmentId: string;
  rescheduleToken: string;
  proposalExpiresAtIso: string;
  doctorName: string;
  slotLabelsCyprus: string[];
};

export function buildPatientRescheduleReminderEmailContent(opts: RescheduleReminderEmailOpts): EmailContent {
  const doctor = nameOr(opts.doctorName, "your professional");
  const patient = nameOr(opts.patientName, "there");
  const deadline = cyprusLongLabel(opts.proposalExpiresAtIso);
  const pickUrl = new URL(
    `/reschedule/${encodeURIComponent(opts.appointmentId)}?token=${encodeURIComponent(opts.rescheduleToken)}`,
    opts.siteUrl,
  ).toString();

  const subject = `Reminder: choose your new time with ${doctor}`;
  const text =
    `Hi ${patient},\n\n` +
    `${doctor} is still holding these times for you. Choose one before ${deadline} (Cyprus time), or your visit will no longer be booked.\n\n` +
    `${opts.slotLabelsCyprus.map((s) => `• ${s}`).join("\n")}\n\n` +
    `None of them work? From the same link you can pick any other free time.\n\n` +
    `Choose a time:\n${pickUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const slotsHtml = opts.slotLabelsCyprus
    .map((s) => `<li style="margin:0 0 6px;font-size:15px;line-height:1.5;color:${EMAIL_TEXT};">${escapeHtml(s)}</li>`)
    .join("");
  const html = shell(
    "Choose your new time",
    paragraph(`Hi ${escapeHtml(patient)},`) +
      paragraph(
        `<strong>${escapeHtml(doctor)}</strong> is still holding these times for you. Choose one before <strong>${escapeHtml(deadline)}</strong> (Cyprus time), or your visit will no longer be booked.`,
      ) +
      `<ul style="margin:12px 0 16px;padding-left:20px;">${slotsHtml}</ul>` +
      paragraph("None of them work? From the same link you can pick any other free time.", true),
    { href: pickUrl, label: "Choose a time" },
  );
  return { subject, text, html };
}

// ---------------------------------------------------------------- expired (patient)

export type RescheduleExpiredEmailOpts = {
  siteUrl: string;
  patientName: string;
  doctorName: string;
  doctorSlug: string;
  /** The visit before it was moved (appointments.appointment_datetime). */
  originalAppointmentIso: string;
};

export function buildPatientRescheduleExpiredEmailContent(opts: RescheduleExpiredEmailOpts): EmailContent {
  const doctor = nameOr(opts.doctorName, "your professional");
  const patient = nameOr(opts.patientName, "there");
  const original = cyprusLongLabel(opts.originalAppointmentIso);
  const bookUrl = new URL(publicProfessionalProfilePath(opts.doctorSlug), opts.siteUrl).toString();

  const subject = `Your visit with ${doctor} is no longer booked`;
  const text =
    `Hi ${patient},\n\n` +
    `You didn't choose a new time before the deadline, so your visit with ${doctor} on ${original} (Cyprus time) is no longer booked. ` +
    `The times that were held for you have been released.\n\n` +
    `You can book a new time online whenever it suits you:\n${bookUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const html = shell(
    "Your visit is no longer booked",
    paragraph(`Hi ${escapeHtml(patient)},`) +
      paragraph(
        `You didn't choose a new time before the deadline, so your visit with <strong>${escapeHtml(doctor)}</strong> on <strong>${escapeHtml(original)}</strong> (Cyprus time) is no longer booked.`,
      ) +
      paragraph("The times that were held for you have been released. You can book a new time online whenever it suits you.", true),
    { href: bookUrl, label: "Book a new time online" },
  );
  return { subject, text, html };
}

// ---------------------------------------------------------------- asked for another time (doctor)

export type AskedOtherTimeEmailOpts = {
  siteUrl: string;
  doctorName: string;
  patientName: string;
  appointmentId: string;
  /** The time the patient picked with "See other times". */
  requestedIso: string;
  /** The visit they moved away from (appointments.rescheduled_from). */
  previousIso: string;
};

export function buildDoctorPatientAskedOtherTimeEmailContent(opts: AskedOtherTimeEmailOpts): EmailContent {
  const doctor = nameOr(opts.doctorName, "there");
  const patient = nameOr(opts.patientName, "Your patient");
  const requested = cyprusLongLabel(opts.requestedIso);
  const previous = cyprusLongLabel(opts.previousIso);
  const reviewUrl = new URL(
    `/dashboard/appointments/${encodeURIComponent(opts.appointmentId)}`,
    opts.siteUrl,
  ).toString();

  const subject = `${patient} asked for another time`;
  const text =
    `Hi ${doctor},\n\n` +
    `None of the times you suggested worked for ${patient}, so they picked another free time instead: ${requested} (Cyprus time).\n` +
    `Their visit was ${previous}. The times you were holding have been released.\n\n` +
    `Review request:\n${reviewUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;
  const html = shell(
    `${patient} asked for another time`,
    paragraph(`Hi ${escapeHtml(doctor)},`) +
      paragraph(
        `None of the times you suggested worked for <strong>${escapeHtml(patient)}</strong>, so they picked another free time instead: <strong>${escapeHtml(requested)}</strong> (Cyprus time).`,
      ) +
      paragraph(`Their visit was ${escapeHtml(previous)}. The times you were holding have been released.`, true),
    { href: reviewUrl, label: "Review request" },
  );
  return { subject, text, html };
}

// ---------------------------------------------------------------- senders (called by the backend)

async function sendTo(
  to: string,
  content: EmailContent,
  resendToOverride?: string | null,
): Promise<void> {
  const recipient =
    resendToOverride && process.env.NODE_ENV !== "production" ? resendToOverride : String(to).trim();
  if (!recipient) return;
  await sendResendEmail({ to: recipient, subject: content.subject, text: content.text, html: content.html });
}

export function sendPatientRescheduleReminderEmail(
  opts: RescheduleReminderEmailOpts & { patientEmail: string; resendToOverride?: string | null },
): Promise<void> {
  return sendTo(opts.patientEmail, buildPatientRescheduleReminderEmailContent(opts), opts.resendToOverride);
}

export function sendPatientRescheduleExpiredEmail(
  opts: RescheduleExpiredEmailOpts & { patientEmail: string; resendToOverride?: string | null },
): Promise<void> {
  return sendTo(opts.patientEmail, buildPatientRescheduleExpiredEmailContent(opts), opts.resendToOverride);
}

export function sendDoctorPatientAskedOtherTimeEmail(
  opts: AskedOtherTimeEmailOpts & { doctorEmail: string; resendToOverride?: string | null },
): Promise<void> {
  return sendTo(opts.doctorEmail, buildDoctorPatientAskedOtherTimeEmailContent(opts), opts.resendToOverride);
}
