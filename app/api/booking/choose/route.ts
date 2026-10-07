import { NextRequest, NextResponse } from "next/server";

import { fetchBlockingAppointments, toBlockingRows } from "@/lib/appointment-blocking-query";
import { consumeAppointmentLink, issuePatientCancelLink } from "@/lib/appointment-links-db";
import { appointmentClinicCopyFromAddress, loadAppointmentClinicPhone } from "@/lib/appointment-clinic-copy";
import { buildProfessionalPatientChoseEmail, sendBuiltEmail } from "@/lib/booking-request-emails";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { loadDoctorSettingsForSlots } from "@/lib/load-doctor-settings-for-slots";
import { refuseSignedInProfessional } from "@/lib/booking-signed-in-guard";
import { loadPatientProposalContext } from "@/lib/patient-proposal";
import { professionalAccountEmail } from "@/lib/professional-account-contact";
import { linkIdForClinic } from "@/lib/professional-account-settings";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";
import { scheduleSlotRefusal } from "@/lib/schedule-slot-check";
import { patientClinicProfileUrl } from "@/lib/patient-email-clinic";
import { sendPatientAppointmentConfirmedEmail } from "@/lib/send-patient-appointment-confirmed-email";
import { loadPrimarySpecialtyName } from "@/lib/specialty-catalogue";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * The patient picks one of the proposed times (user, 2026-10-04). Body `{ token, slot }`.
 * - 200: CONFIRMED at that time; the other held times are freed; the professional is
 *   emailed; the patient gets the confirmation email with a cancel link.
 * - 400: not one of the proposed times. 409: taken meanwhile.
 * - 410 { state }: link invalid, used, expired or the proposal is no longer open.
 */
export async function POST(req: NextRequest) {
  const limited = enforcePublicApiRateLimit(req, "bookingConfirm", {
    body: { message: "Too many attempts. Please try again later." },
  });
  if (limited) return limited;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const refused = await refuseSignedInProfessional(
    service,
    "You're signed in as a professional. To choose a time as a patient, sign out first.",
  );
  if (refused) return refused;

  let body: { token?: unknown; slot?: unknown };
  try {
    body = (await req.json()) as { token?: unknown; slot?: unknown };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const ctx = await loadPatientProposalContext(service, body.token);
  if (ctx.kind !== "proposal") {
    return NextResponse.json({ state: ctx.kind, message: "This link no longer works.", professionalSlug: ctx.professionalSlug }, { status: 410 });
  }
  const slotMs = new Date(String(body.slot ?? "")).getTime();
  const slot = ctx.slots.find((s) => new Date(s).getTime() === slotMs);
  if (!slot) return NextResponse.json({ message: "Please choose one of the proposed times." }, { status: 400 });

  const duration = ctx.appointment.duration_minutes && ctx.appointment.duration_minutes > 0 ? ctx.appointment.duration_minutes : 30;
  const now = new Date();
  // The proposal's clinic → her link there (the schedule lives on the link).
  const linkId = linkIdForClinic(await loadDoctorLocations(ctx.appointment.professional_id), ctx.appointment.clinic_id);
  const loaded = await loadDoctorSettingsForSlots(service, ctx.appointment.professional_id, linkId);
  const { data: blockingRaw, error: blockErr } = await fetchBlockingAppointments(service, ctx.appointment.professional_id);
  if (!loaded || blockErr) {
    console.error("[DocCy] choose: schedule", blockErr);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
  // Re-check against her agenda, ignoring this request's own held times. The minimum
  // notice doesn't apply: she offered this time herself.
  const refusal = scheduleSlotRefusal({
    settingsRow: { ...loaded.settings, minimum_notice_hours: 0 },
    appointmentUtc: new Date(slot),
    durationMinutes: duration,
    blockingRows: toBlockingRows(blockingRaw),
    excludeAppointmentId: ctx.appointment.id,
    now,
  });
  if (refusal?.code === "slot_taken") {
    return NextResponse.json({ code: "slot_taken", message: "That time is no longer free.", professionalSlug: ctx.professional.slug }, { status: 409 });
  }

  if (!(await consumeAppointmentLink(service, ctx.link.id, now))) {
    return NextResponse.json({ state: "used", message: "This link no longer works." }, { status: 410 });
  }
  const { data: saved, error } = await service
    .from("appointments")
    .update({
      status: "CONFIRMED",
      appointment_datetime: slot,
      proposed_slots: null,
      proposal_expires_at: null,
    })
    .eq("id", ctx.appointment.id)
    .eq("status", "NEEDS_RESCHEDULE")
    .select("id")
    .maybeSingle();
  if (error) {
    const status = (error as { code?: string }).code === "23505" ? 409 : 500;
    console.error("[DocCy] choose: update", error);
    return NextResponse.json({ message: status === 409 ? "That time is no longer free." : "Something went wrong." }, { status });
  }
  if (!saved) return NextResponse.json({ state: "used", message: "This proposal is no longer open." }, { status: 410 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const clinicCopy = appointmentClinicCopyFromAddress({
    clinicName: ctx.clinic.name,
    address: ctx.clinic.address,
    mapsLink: ctx.clinic.mapsLink,
    latitude: ctx.clinic.latitude,
    longitude: ctx.clinic.longitude,
  });

  try {
    const patientEmail = String(ctx.appointment.patient_email ?? "").trim();
    if (patientEmail && !isUndeliverableTestEmail(patientEmail)) {
      const cancel = await issuePatientCancelLink(
        service,
        { id: ctx.appointment.id, professional_id: ctx.appointment.professional_id, appointment_datetime: slot },
        siteUrl,
      );
      await sendPatientAppointmentConfirmedEmail({
        siteUrl,
        patientEmail,
        patientName: ctx.appointment.patient_name,
        appointmentId: ctx.appointment.id,
        appointmentDatetimeIso: slot,
        durationMinutes: duration,
        reason: ctx.appointment.reason,
        doctor: {
          name: ctx.professional.name,
          specialty: await loadPrimarySpecialtyName(service, ctx.professional.id),
          phone: await loadAppointmentClinicPhone(service, linkId),
          clinic_address: ctx.clinic.address,
        },
        clinic: clinicCopy,
        profileUrl: patientClinicProfileUrl(siteUrl, ctx.professional.slug),
        cancel,
      });
    } else {
      // Still issue the cancel link so the visit has one (e.g. for a later resend).
      await issuePatientCancelLink(
        service,
        { id: ctx.appointment.id, professional_id: ctx.appointment.professional_id, appointment_datetime: slot },
        siteUrl,
      );
    }
  } catch (err) {
    console.error("[DocCy] choose: patient confirmation", err);
  }

  try {
    await sendBuiltEmail(
      professionalAccountEmail(ctx.professional),
      buildProfessionalPatientChoseEmail({
        professionalName: ctx.professional.name,
        patientName: ctx.appointment.patient_name,
        appointmentIso: slot,
        clinic: { name: ctx.clinic.name, address: ctx.clinic.address, mapsUrl: clinicCopy.mapsUrl || null },
        agendaUrl: new URL("/agenda", siteUrl).toString(),
      }),
    );
  } catch (err) {
    console.error("[DocCy] choose: professional email", err);
  }

  return NextResponse.json({ appointment: { id: ctx.appointment.id, appointment_datetime: slot, status: "CONFIRMED" } }, { status: 200 });
}
