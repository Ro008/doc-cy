import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { sendPatientRequestDeclinedEmail } from "@/lib/send-patient-request-declined-email";

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
        message: `Please provide a reason for the patient (at least ${REASON_MIN} characters).`,
      },
      { status: 400 }
    );
  }
  if (reasonRaw.length > REASON_MAX) {
    return NextResponse.json(
      { message: "Reason is too long." },
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
    .from("doctors")
    .select("id, name, slug")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, patient_email, status"
    )
    .eq("id", id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.doctor_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const st = String(appt.status ?? "").trim().toUpperCase();
  if (st !== "REQUESTED") {
    return NextResponse.json(
      {
        message:
          "Only pending requests can be declined this way. Confirmed visits can be cancelled from the calendar.",
      },
      { status: 400 }
    );
  }

  const slug = String((doctor as { slug?: string | null }).slug ?? "").trim();
  if (!slug) {
    console.error("[DocCy] reject: doctor has no slug", doctor.id);
    return NextResponse.json(
      { message: "Professional profile is missing a public link. Contact support." },
      { status: 500 }
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const resendToOverride =
    process.env.NODE_ENV !== "production"
      ? process.env.RESEND_TO_OVERRIDE?.trim() || null
      : null;

  try {
    await sendPatientRequestDeclinedEmail({
      siteUrl,
      patientEmail: String(appt.patient_email ?? ""),
      patientName: String(appt.patient_name ?? ""),
      doctorName: String((doctor as { name?: string | null }).name ?? ""),
      doctorSlug: slug,
      declineReason: reasonRaw,
      resendToOverride,
    });
  } catch (e) {
    console.error("[DocCy] Decline request email failed", e);
  }

  const { error: delErr } = await supabase.from("appointments").delete().eq("id", id);

  if (delErr) {
    console.error(delErr);
    return NextResponse.json(
      { message: "Could not remove the request after notifying the patient." },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Request declined." }, { status: 200 });
}
