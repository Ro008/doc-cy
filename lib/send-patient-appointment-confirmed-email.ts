import { addMinutes, format } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
  sendResendEmail,
  AUTOMATED_EMAIL_FOOTER_TEXT,
  automatedEmailFooterHtml,
  escapeHtml,
} from "@/lib/resend";
import {
  buildGoogleCalendarUrl,
  getCalendarEventDetails,
} from "@/lib/patient-calendar-event";
import { phoneToWaMeLink } from "@/lib/whatsapp";

const CAL_GOOGLE_STYLE =
  "display:block;text-align:center;background:#34d399;color:#022c22;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;margin:0 0 10px;font-size:15px;";
const CAL_ICS_STYLE =
  "display:block;text-align:center;background:rgba(52,211,153,.14);color:#a7f3d0;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;border:1px solid rgba(52,211,153,.35);font-size:15px;";
const WHATSAPP_CTA_STYLE =
  "display:block;text-align:center;background:#25D366;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 16px;border-radius:12px;margin:0 0 12px;font-size:15px;";
const PRIMARY_ACTIONS_LABEL =
  "margin:18px 0 10px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;";

type DoctorPayload = {
  name?: string | null;
  specialty?: string | null;
  phone?: string | null;
  clinic_address?: string | null;
};

/**
 * Sends the patient the post-confirmation email with calendar links (.ics + Google).
 * Best-effort: callers should catch/log; booking flows must not depend on Resend.
 */
export async function sendPatientAppointmentConfirmedEmail(opts: {
  siteUrl: string;
  patientEmail: string;
  patientName: string;
  appointmentId: string;
  appointmentDatetimeIso: string;
  durationMinutes: number;
  reason?: string | null;
  doctor: DoctorPayload;
  resendToOverride?: string | null;
}): Promise<void> {
  const {
    siteUrl,
    patientEmail,
    patientName,
    appointmentId,
    appointmentDatetimeIso,
    durationMinutes,
    reason,
    doctor,
    resendToOverride,
  } = opts;

  const doctorName = String(doctor.name ?? "your professional").trim();
  const doctorWaMe = phoneToWaMeLink(doctor.phone);
  const patientEmailTo = String(patientEmail).trim();

  const startUtc = new Date(appointmentDatetimeIso);
  const endUtc = addMinutes(startUtc, durationMinutes);
  const cyDate = appointmentToCyprusDate(appointmentDatetimeIso);
  const whenLabel = format(cyDate, "EEEE, d MMMM yyyy 'at' HH:mm", { locale: enUS });

  const cal = getCalendarEventDetails(
    { id: appointmentId, appointment_datetime: appointmentDatetimeIso },
    {
      name: doctor.name,
      specialty: doctor.specialty,
      phone: doctor.phone,
      clinic_address: doctor.clinic_address,
    },
    { reason: reason ?? null, visitType: null, visitNotes: null },
    { includeWhatsAppContact: true }
  );

  const patientGoogleUrl = buildGoogleCalendarUrl({
    title: cal.title,
    description: cal.description,
    location: cal.location,
    startUtc,
    endUtc,
  });

  const patientIcsUrl = new URL(
    `/api/appointments/${encodeURIComponent(appointmentId)}/calendar`,
    siteUrl
  ).toString();

  let text =
    `Hi ${patientName},\n\n` +
    `Your appointment with ${doctorName} is confirmed for ${whenLabel} (Cyprus time).\n\n` +
    `You can add it to your calendar:\n\n` +
    `Google Calendar: ${patientGoogleUrl}\n` +
    `Apple / Outlook (.ics): ${patientIcsUrl}\n\n`;

  if (doctorWaMe) {
    text += `WhatsApp: ${doctorWaMe}\n\n`;
  }
  text += `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
<div style="margin:0;padding:20px;background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px;">
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">Appointment confirmed</h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">Hi ${escapeHtml(patientName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#e2e8f0;">
      Your appointment with <strong>${escapeHtml(doctorName)}</strong> is confirmed for
      <strong>${escapeHtml(whenLabel)}</strong> (Cyprus time). You can add it to your calendar below.
    </p>

    <p style="${PRIMARY_ACTIONS_LABEL}">Calendar</p>
    <a href="${patientGoogleUrl}" style="${CAL_GOOGLE_STYLE}">Add to Google Calendar</a>
    <a href="${patientIcsUrl}" style="${CAL_ICS_STYLE}">Add to Apple / Outlook (.ics)</a>

    ${
      doctorWaMe
        ? `<p style="${PRIMARY_ACTIONS_LABEL}">Contact</p><a href="${doctorWaMe}" style="${WHATSAPP_CTA_STYLE}">💬 Message ${escapeHtml(doctorName)} on WhatsApp</a>`
        : ""
    }

    ${automatedEmailFooterHtml()}
  </div>
</div>`;

  const recipient = resendToOverride || patientEmailTo;
  if (!recipient) {
    console.warn("[DocCy] Patient confirmation email skipped: no recipient.");
    return;
  }

  await sendResendEmail({
    to: recipient,
    subject: `Confirmed — ${doctorName} · ${whenLabel}`,
    text,
    html,
  });
}
