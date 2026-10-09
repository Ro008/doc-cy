import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { agendaPreviousVisits, loadPreviousVisits, previousVisitsBefore } from "@/lib/previous-visits";
import { createServiceRoleClient } from "@/lib/supabase-service";

type RouteContext = { params: { id: string } };

/** The agenda lists this many earlier visits with the same patient. */
const AGENDA_PREVIOUS_VISITS = 3;
/** The "Show more" window lists up to this many. */
const ALL_PREVIOUS_VISITS = 49;

/**
 * Her earlier visits with the patient of this visit, with her private notes (user,
 * 2026-10-08). Only the signed-in professional who owns the visit; never any contact details.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ message: "Missing appointment id." }, { status: 400 });
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
    .select("id, professional_id, appointment_datetime, patient_email, patient_phone")
    .eq("id", id)
    .maybeSingle();
  if (!appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }
  if (appt.professional_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  // ?all=1: the whole list for the "Show more" window (newest first, capped by the query).
  const all = req.nextUrl.searchParams.get("all") === "1";
  const shown = all ? ALL_PREVIOUS_VISITS : AGENDA_PREVIOUS_VISITS;

  const who = {
    email: (appt.patient_email as string | null) ?? null,
    phone: (appt.patient_phone as string | null) ?? null,
  };
  const rows = await loadPreviousVisits(
    service,
    {
      professionalId: doctor.id as string,
      appointmentId: appt.id as string,
      ...who,
      before: previousVisitsBefore(String(appt.appointment_datetime), new Date()),
    },
    shown + 1,
  );
  return NextResponse.json(agendaPreviousVisits(rows, who, shown));
}
