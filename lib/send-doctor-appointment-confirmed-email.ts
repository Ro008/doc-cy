import { addMinutes, format } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import { buildGoogleCalendarUrl } from "@/lib/patient-calendar-event";
import { getDoctorCalendarEventDetails } from "@/lib/doctor-calendar-event";

import {
  EMAIL_CAL_GOOGLE_BTN,
  EMAIL_CAL_ICS_BTN,
  EMAIL_LINK_ACCENT,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_HEADING,
} from "@/lib/email-brand";

const CAL_GOOGLE_STYLE = EMAIL_CAL_GOOGLE_BTN;
const CAL_ICS_STYLE = EMAIL_CAL_ICS_BTN;

export async function sendDoctorAppointmentConfirmedEmail(opts: {
  siteUrl: string;
  doctorEmail: string;
  doctorName: string;
  appointmentId: string;
  appointmentDatetimeIso: string;
  durationMinutes: number;
  patientName: string;
  patientPhone?: string | null;
  reason?: string | null;
  resendToOverride?: string | null;
  manualCreated?: boolean;
}): Promise<void> {
  const doctorEmail = String(opts.doctorEmail).trim();
  if (!doctorEmail) return;

  const startUtc = new Date(opts.appointmentDatetimeIso);
  const endUtc = addMinutes(startUtc, opts.durationMinutes);
  const cyDate = appointmentToCyprusDate(opts.appointmentDatetimeIso);
  const whenLabel = format(cyDate, "EEEE, d MMMM yyyy 'at' HH:mm", {
    locale: enUS,
  });

  const cal = getDoctorCalendarEventDetails(
    {
      patient_name: opts.patientName,
      patient_phone: opts.patientPhone ?? null,
    },
    {
      name: opts.doctorName,
    },
    {
      reason: opts.reason ?? null,
      visitType: null,
      visitNotes: null,
    },
  );
  const googleUrl = buildGoogleCalendarUrl({
    title: cal.title,
    description: cal.description,
    location: cal.location,
    startUtc,
    endUtc,
  });
  const icsUrl = new URL(
    `/api/appointments/${encodeURIComponent(opts.appointmentId)}/calendar?audience=doctor`,
    opts.siteUrl,
  ).toString();
  const agendaUrl = new URL("/agenda", opts.siteUrl).toString();

  const recipient = opts.resendToOverride || doctorEmail;
  const heading = opts.manualCreated
    ? "Manual booking created"
    : "Appointment confirmed";
  const opening = opts.manualCreated
    ? `Hi ${opts.doctorName}, you manually created and confirmed a booking for <strong>${escapeHtml(
        opts.patientName,
      )}</strong> on <strong>${escapeHtml(whenLabel)}</strong> (Cyprus time).`
    : `Hi ${opts.doctorName}, you confirmed <strong>${escapeHtml(
        opts.patientName,
      )}</strong> for <strong>${escapeHtml(whenLabel)}</strong> (Cyprus time).`;
  const text =
    `Hi ${opts.doctorName},\n\n` +
    (opts.manualCreated
      ? `You manually created and confirmed ${opts.patientName}'s appointment for ${whenLabel} (Cyprus time).\n\n`
      : `You confirmed ${opts.patientName}'s appointment for ${whenLabel} (Cyprus time).\n\n`) +
    `Manage any changes from your DocCy agenda: ${agendaUrl}\n` +
    `Google Calendar is optional and does not sync edits back to DocCy.\n\n` +
    `Add to calendar:\n` +
    `Google Calendar: ${googleUrl}\n` +
    `Apple / Outlook (.ics): ${icsUrl}\n\n` +
    `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">${heading}</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      ${opening}
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#D8E3EC;">
      Manage all updates directly from your <a href="${agendaUrl}" style="${EMAIL_LINK_ACCENT}">DocCy agenda</a>. Google Calendar is optional and does not sync edits back to DocCy.
    </p>
    <a href="${googleUrl}" style="${CAL_GOOGLE_STYLE}">Add to Google Calendar</a>
    <a href="${icsUrl}" style="${CAL_ICS_STYLE}">Add to Apple / Outlook (.ics)</a>
    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  await sendResendEmail({
    to: recipient,
    subject: opts.manualCreated
      ? `Manual booking created: ${opts.patientName} · ${whenLabel}`
      : `Confirmed visit with ${opts.patientName} · ${whenLabel}`,
    text,
    html,
  });
}
