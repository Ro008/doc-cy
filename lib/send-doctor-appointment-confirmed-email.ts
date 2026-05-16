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
import { buildAppointmentCalendarToken } from "@/lib/appointment-calendar-token";

const CAL_GOOGLE_STYLE =
  "display:block;text-align:center;background:#34d399;color:#022c22;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;margin:0 0 10px;font-size:15px;";
const CAL_ICS_STYLE =
  "display:block;text-align:center;background:rgba(52,211,153,.14);color:#a7f3d0;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;border:1px solid rgba(52,211,153,.35);font-size:15px;";

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
  const doctorIcsParams = new URLSearchParams({ audience: "doctor" });
  const doctorCalendarToken = buildAppointmentCalendarToken(
    opts.appointmentId,
    "doctor"
  );
  if (doctorCalendarToken) doctorIcsParams.set("token", doctorCalendarToken);
  const icsUrl = new URL(
    `/api/appointments/${encodeURIComponent(
      opts.appointmentId
    )}/calendar?${doctorIcsParams.toString()}`,
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
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">${heading}</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      ${opening}
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#cbd5e1;">
      Manage all updates directly from your <a href="${agendaUrl}" style="color:#a7f3d0;font-weight:600;">DocCy agenda</a>. Google Calendar is optional and does not sync edits back to DocCy.
    </p>
    <a href="${googleUrl}" style="${CAL_GOOGLE_STYLE}">Add to Google Calendar</a>
    <a href="${icsUrl}" style="${CAL_ICS_STYLE}">Add to Apple / Outlook (.ics)</a>
    ${automatedEmailFooterHtml()}
  </div>
</div>`;

  await sendResendEmail({
    to: recipient,
    subject: opts.manualCreated
      ? `Manual booking created: ${opts.patientName} · ${whenLabel}`
      : `Confirmed visit with ${opts.patientName} · ${whenLabel}`,
    text,
    html,
  });
}
