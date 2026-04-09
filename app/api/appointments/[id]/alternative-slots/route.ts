import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  isAllowedProfessionalDuration,
  PROFESSIONAL_DURATION_OPTIONS,
} from "@/lib/professional-appointment-durations";
import { candidateOverlapsAnyBlockingInterval } from "@/lib/appointment-overlap";
import { findFirstAlternativeSlotStarts } from "@/lib/find-alternative-appointment-slots";
import { loadDoctorSettingsForSlots } from "@/lib/load-doctor-settings-for-slots";
import {
  fetchBlockingAppointments,
  toBlockingRows,
} from "@/lib/appointment-blocking-query";

type RouteContext = { params: { id: string } };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ message: "Missing appointment id." }, { status: 400 });
  }

  const raw = req.nextUrl.searchParams.get("durationMinutes");
  const durationMinutes = raw != null ? Number.parseInt(raw, 10) : NaN;
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
    .from("doctors")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select("id, doctor_id, appointment_datetime, status")
    .eq("id", id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.doctor_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const st = String(appt.status ?? "").toUpperCase();
  if (st !== "REQUESTED" && st !== "CONFIRMED") {
    return NextResponse.json(
      { message: "Alternatives are only available for pending or confirmed visits." },
      { status: 400 }
    );
  }

  const loaded = await loadDoctorSettingsForSlots(supabase, doctor.id);
  if (!loaded) {
    return NextResponse.json(
      { message: "Professional settings not found." },
      { status: 500 }
    );
  }

  const { data: blockingRaw, error: blockErr } = await fetchBlockingAppointments(
    supabase,
    doctor.id
  );
  if (blockErr) {
    console.error(blockErr);
    return NextResponse.json(
      { message: "Error loading schedule." },
      { status: 500 }
    );
  }

  const blockingRows = toBlockingRows(blockingRaw);
  const hasConflict = candidateOverlapsAnyBlockingInterval(
    appt.appointment_datetime as string,
    durationMinutes,
    id,
    blockingRows,
    loaded.fallbackSlotDurationMinutes
  );

  if (st === "REQUESTED" && !hasConflict) {
    return NextResponse.json(
      { message: "No conflict for this duration; confirm the request instead." },
      { status: 400 }
    );
  }

  const slots = findFirstAlternativeSlotStarts({
    settings: loaded.settings,
    weeklySlots: loaded.weeklySlots,
    blockingRows,
    fallbackSlotDurationMinutes: loaded.fallbackSlotDurationMinutes,
    visitDurationMinutes: durationMinutes,
    excludeAppointmentId: id,
    searchFromAppointmentIso: appt.appointment_datetime as string,
    avoidStartIso: appt.appointment_datetime as string,
  });

  return NextResponse.json({ slots, count: slots.length });
}
