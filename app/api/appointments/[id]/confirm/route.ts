import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { candidateOverlapsAnyBlockingInterval } from "@/lib/appointment-overlap";
import {
  fetchBlockingAppointments,
  toBlockingRows,
} from "@/lib/appointment-blocking-query";
import {
  isAllowedProfessionalDuration,
  PROFESSIONAL_DURATION_OPTIONS,
} from "@/lib/professional-appointment-durations";
import { appointmentClinicCopy, loadAppointmentClinicPhone } from "@/lib/appointment-clinic-copy";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import { clinicSlotMinutes } from "@/lib/professional-account-settings";
import { loadPatientEmailClinic, patientClinicProfileUrl } from "@/lib/patient-email-clinic";
import { sendPatientAppointmentConfirmedEmail } from "@/lib/send-patient-appointment-confirmed-email";
import { issuePatientCancelLink } from "@/lib/appointment-links-db";
import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { loadPrimarySpecialtyName } from "@/lib/specialty-catalogue";

type RouteContext = { params: { id: string } };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ message: "Missing appointment id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const durationMinutes = Number((body as { durationMinutes?: unknown }).durationMinutes);
  if (!isAllowedProfessionalDuration(durationMinutes)) {
    return NextResponse.json(
      {
        message: `Invalid durationMinutes. Allowed values (minutes): ${PROFESSIONAL_DURATION_OPTIONS.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { data: doctor, error: doctorErr } = await supabase
    .from("professionals")
    .select("id, name, slug, email, registration_email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      "id, professional_id, patient_name, patient_email, patient_phone, appointment_datetime, status, reason, duration_minutes, clinic_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.professional_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const statusUpper = String(appt.status ?? "").toUpperCase();
  if (statusUpper !== "REQUESTED") {
    return NextResponse.json(
      { message: "Only pending requests can be confirmed." },
      { status: 400 }
    );
  }

  // A visit saved without a length counts as the primary clinic's slot (Point E6: the
  // slot length lives on the clinic link).
  const locations = await loadDoctorLocations(doctor.id);
  const fallbackDuration = clinicSlotMinutes(locations);

  const { data: blockingRaw, error: othersErr } = await fetchBlockingAppointments(
    supabase,
    doctor.id
  );

  if (othersErr) {
    console.error(othersErr);
    return NextResponse.json(
      { message: "Error checking schedule." },
      { status: 500 }
    );
  }

  const hasConflict = candidateOverlapsAnyBlockingInterval(
    appt.appointment_datetime as string,
    durationMinutes,
    id,
    toBlockingRows(blockingRaw),
    fallbackDuration
  );

  if (hasConflict) {
    return NextResponse.json(
      { message: "This duration overlaps another appointment." },
      { status: 409 }
    );
  }

  // Guarded on REQUESTED so a double click or a concurrent decline can't overwrite it.
  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ message: "Server misconfiguration." }, { status: 503 });
  }
  const { data: confirmed, error: updateErr } = await service
    .from("appointments")
    .update({
      status: "CONFIRMED",
      duration_minutes: durationMinutes,
    })
    .eq("id", id)
    .eq("professional_id", doctor.id)
    .eq("status", "REQUESTED")
    .select("id")
    .maybeSingle();

  if (updateErr) {
    console.error(updateErr);
    return NextResponse.json(
      { message: "Could not confirm appointment." },
      { status: 500 }
    );
  }
  if (!confirmed) {
    return NextResponse.json({ message: "This request was already answered." }, { status: 409 });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const resendToOverride =
    process.env.NODE_ENV !== "production"
      ? process.env.RESEND_TO_OVERRIDE?.trim() || null
      : null;

  const clinic = appointmentClinicCopy({
    locations,
    clinicId: (appt as { clinic_id?: string | null }).clinic_id,
  });

  const specialtyService = service;
  const specialtyName = specialtyService
    ? await loadPrimarySpecialtyName(specialtyService, doctor.id as string)
    : null;

  // The patient's cancel link (until X hours before the visit; user, 2026-10-04).
  let cancel: { url: string; deadlineLabel: string } | null = null;
  try {
    cancel = await issuePatientCancelLink(
      service,
      { id, professional_id: doctor.id as string, appointment_datetime: String(appt.appointment_datetime) },
      siteUrl,
    );
  } catch (e) {
    console.error("[DocCy] cancel link", e);
  }

  try {
    const patientEmail = String(appt.patient_email ?? "").trim();
    if (patientEmail && !isUndeliverableTestEmail(patientEmail)) await sendPatientAppointmentConfirmedEmail({
      siteUrl,
      patientEmail: String(appt.patient_email),
      patientName: String(appt.patient_name),
      appointmentId: id,
      appointmentDatetimeIso: String(appt.appointment_datetime),
      durationMinutes,
      reason: (appt as { reason?: string | null }).reason ?? null,
      doctor: {
        name: doctor.name,
        specialty: specialtyName,
        // Signed-in client can't read clinics (RLS): the service role reads the phone.
        phone: specialtyService
          ? await loadAppointmentClinicPhone(specialtyService, clinic.locationId)
          : null,
        clinic_address: clinic.address,
      },
      clinic,
      profileUrl: patientClinicProfileUrl(siteUrl, (doctor as { slug?: string | null }).slug),
      cancel,
      resendToOverride,
    });
  } catch (e) {
    console.error("[DocCy] Patient confirmation email failed", e);
  }

  // No email to the professional about a visit she accepted herself (user, 2026-10-02).

  return NextResponse.json({
    message: "Appointment confirmed.",
    appointment: { id, status: "CONFIRMED", duration_minutes: durationMinutes },
  });
}
