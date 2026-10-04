import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { sendPatientConfirmedAppointmentCancelledEmail } from "@/lib/send-patient-confirmed-appointment-cancelled-email";
import { revokeAppointmentLinks } from "@/lib/appointment-links-db";
import { isUndeliverableTestEmail } from "@/lib/registration-decision-emails";
import { createServiceRoleClient } from "@/lib/supabase-service";

type RouteContext = { params: { id: string } };

const REASON_MIN = 10;
const REASON_MAX = 4000;

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

  const reasonRaw = String((body as { reason?: unknown }).reason ?? "").trim();
  if (reasonRaw.length < REASON_MIN) {
    return NextResponse.json(
      {
        message: `Please give the patient a short explanation (at least ${REASON_MIN} characters).`,
      },
      { status: 400 }
    );
  }
  if (reasonRaw.length > REASON_MAX) {
    return NextResponse.json({ message: "Reason is too long." }, { status: 400 });
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
    .select("id, name, slug")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      "id, professional_id, patient_name, patient_email, patient_phone, status, appointment_datetime"
    )
    .eq("id", id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.professional_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const st = String(appt.status ?? "").trim().toUpperCase();
  if (st !== "CONFIRMED") {
    return NextResponse.json(
      {
        message:
          "Only confirmed visits can be cancelled this way. Pending requests use Decline.",
      },
      { status: 400 }
    );
  }

  const slug = String((doctor as { slug?: string | null }).slug ?? "").trim();
  if (!slug) {
    console.error("[DocCy] cancel-confirmed: doctor has no slug", doctor.id);
    return NextResponse.json(
      { message: "Professional profile is missing a public link. Contact support." },
      { status: 500 }
    );
  }

  const appointmentDatetimeIso = String(
    (appt as { appointment_datetime?: string }).appointment_datetime ?? ""
  ).trim();
  if (!appointmentDatetimeIso) {
    return NextResponse.json(
      { message: "Appointment has no scheduled time." },
      { status: 400 }
    );
  }

  // She can cancel until the visit starts, however short the notice (user, 2026-10-04).
  if (new Date(appointmentDatetimeIso).getTime() <= Date.now()) {
    return NextResponse.json(
      { message: "This visit has already started. Mark the attendance instead." },
      { status: 400 }
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const resendToOverride =
    process.env.NODE_ENV !== "production"
      ? process.env.RESEND_TO_OVERRIDE?.trim() || null
      : null;

  // Kept as CANCELLED by her with the reason (never deleted). Guarded on CONFIRMED.
  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ message: "Server misconfiguration." }, { status: 503 });
  }
  const { data: cancelled, error: updateErr } = await service
    .from("appointments")
    .update({ status: "CANCELLED", cancelled_by: "professional", cancel_reason: reasonRaw })
    .eq("id", id)
    .eq("professional_id", doctor.id)
    .eq("status", "CONFIRMED")
    .select("id")
    .maybeSingle();
  if (updateErr) {
    console.error("[DocCy] cancel-confirmed update", updateErr);
    return NextResponse.json({ message: "Could not cancel the appointment." }, { status: 500 });
  }
  if (!cancelled) {
    return NextResponse.json({ message: "This visit is no longer confirmed." }, { status: 409 });
  }
  // The patient's own cancel link stops working.
  await revokeAppointmentLinks(service, id, "cancel").catch((e) =>
    console.error("[DocCy] cancel-confirmed: revoke patient link", e),
  );

  const patientEmail = String(appt.patient_email ?? "").trim();
  try {
    if (patientEmail && !isUndeliverableTestEmail(patientEmail)) {
      await sendPatientConfirmedAppointmentCancelledEmail({
        siteUrl,
        patientEmail,
        patientName: String(appt.patient_name ?? ""),
        doctorName: String((doctor as { name?: string | null }).name ?? ""),
        doctorSlug: slug,
        appointmentDatetimeIso,
        cancelReason: reasonRaw,
        resendToOverride,
      });
    }
  } catch (e) {
    console.error("[DocCy] Confirmed cancel email failed", e);
  }

  // No email on file: she has to call the patient (the dialog says so).
  return NextResponse.json(
    {
      message: "Appointment cancelled.",
      patientHasEmail: Boolean(patientEmail),
      patientPhone: patientEmail ? null : (appt as { patient_phone?: string | null }).patient_phone ?? null,
    },
    { status: 200 }
  );
}
