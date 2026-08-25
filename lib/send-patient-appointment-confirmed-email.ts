import { addMinutes, format } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
  appointmentClinicCopyFromAddress,
  formatAppointmentClinicEmailHtml,
  formatAppointmentClinicEmailText,
  type AppointmentClinicCopy,
} from "@/lib/appointment-clinic-copy";
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
import {
  EMAIL_CAL_GOOGLE_BTN,
  EMAIL_CAL_ICS_BTN,
  EMAIL_SECTION_LABEL,
  EMAIL_SHELL_CLOSE,
  EMAIL_SHELL_OPEN,
  EMAIL_TEXT,
  EMAIL_HEADING,
} from "@/lib/email-brand";

const CAL_GOOGLE_STYLE = EMAIL_CAL_GOOGLE_BTN;
const CAL_ICS_STYLE = EMAIL_CAL_ICS_BTN;
const WHATSAPP_CTA_STYLE =
  "display:block;text-align:center;background:#25D366;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 16px;border-radius:12px;margin:0 0 12px;font-size:15px;";
const PRIMARY_ACTIONS_LABEL = EMAIL_SECTION_LABEL;

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
  clinic?: AppointmentClinicCopy | null;
  isAfterReschedule?: boolean;
  resendToOverride?: string | null;
}): Promise<void> {
  const content = buildPatientAppointmentConfirmedEmailContent(opts);
  const patientEmailTo = String(opts.patientEmail).trim();
  const recipient = opts.resendToOverride || patientEmailTo;
  if (!recipient) {
    console.warn("[DocCy] Patient confirmation email skipped: no recipient.");
    return;
  }

  await sendResendEmail({
    to: recipient,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

export function buildPatientAppointmentConfirmedEmailContent(opts: {
  siteUrl: string;
  patientEmail: string;
  patientName: string;
  appointmentId: string;
  appointmentDatetimeIso: string;
  durationMinutes: number;
  reason?: string | null;
  doctor: DoctorPayload;
  clinic?: AppointmentClinicCopy | null;
  isAfterReschedule?: boolean;
  resendToOverride?: string | null;
}): { subject: string; text: string; html: string } {
  const {
    siteUrl,
    patientName,
    appointmentId,
    appointmentDatetimeIso,
    durationMinutes,
    reason,
    doctor,
    isAfterReschedule,
  } = opts;

  const doctorName = String(doctor.name ?? "your professional").trim();
  const doctorWaMe = phoneToWaMeLink(doctor.phone);
  const clinic =
    opts.clinic ??
    appointmentClinicCopyFromAddress({
      address: doctor.clinic_address,
    });

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
      clinic_address: clinic.address,
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
    `${formatAppointmentClinicEmailText(clinic)}\n` +
    `You can add it to your calendar:\n\n` +
    `Google Calendar: ${patientGoogleUrl}\n` +
    `Apple / Outlook (.ics): ${patientIcsUrl}\n\n`;
  if (isAfterReschedule) {
    text +=
      `IMPORTANT - RESCHEDULED VISIT:\n` +
      `If you already added your previous confirmed visit to calendar, delete that old entry now.\n` +
      `DocCy cannot remove old events from your personal calendar.\n\n`;
  }

  if (doctorWaMe) {
    text += `WhatsApp: ${doctorWaMe}\n\n`;
  }
  text += `---\n${AUTOMATED_EMAIL_FOOTER_TEXT}`;

  const html = `
${EMAIL_SHELL_OPEN}
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${EMAIL_HEADING};">
      ${isAfterReschedule ? "Appointment re-confirmed (rescheduled)" : "Appointment confirmed"}
    </h2>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">Hi ${escapeHtml(patientName)},</p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${EMAIL_TEXT};">
      Your appointment with <strong>${escapeHtml(doctorName)}</strong> is confirmed for
      <strong>${escapeHtml(whenLabel)}</strong> (Cyprus time). You can add it to your calendar below.
    </p>
    ${formatAppointmentClinicEmailHtml(clinic)}
    ${
      isAfterReschedule
        ? `<div style="margin:0 0 14px;padding:12px 13px;border:2px solid #f59e0b;background:rgba(245,158,11,.16);border-radius:12px;">
            <p style="margin:0 0 6px;font-size:12px;line-height:1.35;color:#fbbf24;font-weight:800;letter-spacing:.04em;text-transform:uppercase;">
              ⚠️ Important: this visit was rescheduled
            </p>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#fde68a;">
              If you already added the previous confirmed visit to your calendar, please delete that old calendar entry now to avoid duplicates.
              <br />
              <span style="color:#fcd34d;">DocCy cannot remove old events from your personal calendar.</span>
            </p>
          </div>`
        : ""
    }

    <p style="${PRIMARY_ACTIONS_LABEL}">Calendar</p>
    <a href="${patientGoogleUrl}" style="${CAL_GOOGLE_STYLE}">Add to Google Calendar</a>
    <a href="${patientIcsUrl}" style="${CAL_ICS_STYLE}">Add to Apple / Outlook (.ics)</a>

    ${
      doctorWaMe
        ? `<p style="${PRIMARY_ACTIONS_LABEL}">Contact</p><a href="${doctorWaMe}" style="${WHATSAPP_CTA_STYLE}">💬 Message ${escapeHtml(doctorName)} on WhatsApp</a>`
        : ""
    }

    ${automatedEmailFooterHtml()}
${EMAIL_SHELL_CLOSE}`;

  return {
    subject: isAfterReschedule
      ? `Rescheduled confirmed — remove previous calendar event · ${doctorName} · ${whenLabel}`
      : `Confirmed — ${doctorName} · ${whenLabel}`,
    text,
    html,
  };
}
