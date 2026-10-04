import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { parseProfessionalNotes, professionalNotesEditRefusal } from "@/lib/professional-notes";
import { createServiceRoleClient } from "@/lib/supabase-service";

type RouteContext = { params: { id: string } };

/**
 * Her private notes on a visit (user, 2026-10-04): only hers, only once the visit has
 * started, only while CONFIRMED (no-shows too). Never sent to the patient.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

  const parsed = parseProfessionalNotes((body as { notes?: unknown }).notes);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
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
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
  }

  const { data: appt } = await service
    .from("appointments")
    .select("id, professional_id, status, appointment_datetime")
    .eq("id", id)
    .maybeSingle();
  if (!appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }
  if (appt.professional_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const now = new Date();
  const refusal = professionalNotesEditRefusal({
    status: appt.status as string | null,
    appointmentIso: String(appt.appointment_datetime),
    now,
  });
  if (refusal) {
    return NextResponse.json({ message: refusal.message, code: refusal.code }, { status: 400 });
  }

  const { data: updated, error } = await service
    .from("appointments")
    .update({ professional_notes: parsed.value })
    .eq("id", id)
    .eq("professional_id", doctor.id)
    .eq("status", "CONFIRMED")
    .lte("appointment_datetime", now.toISOString())
    .select("id");
  if (error) {
    console.error("[DocCy] notes update failed", error);
    return NextResponse.json({ message: "Could not save your notes." }, { status: 500 });
  }
  if (!updated?.length) {
    return NextResponse.json({ message: "This visit changed in the meantime. Please reload." }, { status: 409 });
  }

  return NextResponse.json({ notes: parsed.value });
}
