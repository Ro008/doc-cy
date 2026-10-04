import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  isAllowedProfessionalDuration,
  PROFESSIONAL_DURATION_OPTIONS,
} from "@/lib/professional-appointment-durations";
import { findFirstAlternativeSlotStarts } from "@/lib/find-alternative-appointment-slots";
import { loadDoctorSettingsForSlots } from "@/lib/load-doctor-settings-for-slots";
import {
  fetchBlockingAppointments,
  toBlockingRows,
} from "@/lib/appointment-blocking-query";

type RouteContext = { params: { id: string } };

/**
 * Free times she can propose for a request (user, 2026-10-04).
 * - Default: the first three after the requested time (the picker pre-fills them).
 * - `?date=YYYY-MM-DD`: every free time that day, to swap one for another.
 * - `?locationId=`: at another of her clinic links (default the request's clinic).
 */

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
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select("id, professional_id, appointment_datetime, status, location_id, clinic_id")
    .eq("id", id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.professional_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const st = String(appt.status ?? "").toUpperCase();
  // Only a request gets other times; a confirmed visit can only be cancelled.
  if (st !== "REQUESTED") {
    return NextResponse.json(
      { message: "Other times can only be suggested for a pending request." },
      { status: 400 }
    );
  }

  const dateKey = req.nextUrl.searchParams.get("date");
  if (dateKey != null && !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return NextResponse.json({ message: "Invalid date." }, { status: 400 });
  }
  const locationId =
    req.nextUrl.searchParams.get("locationId")?.trim() ||
    (appt as { location_id?: string | null }).location_id;

  // At the chosen clinic (its hours and slot length, Point E6).
  const loaded = await loadDoctorSettingsForSlots(supabase, doctor.id, locationId);
  if (!loaded) {
    return NextResponse.json(
      { message: "This clinic is not set up yet. Contact us to set it up." },
      { status: 409 }
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
  const slots = findFirstAlternativeSlotStarts({
    settings: loaded.settings,
    weeklySlots: loaded.weeklySlots,
    blockingRows,
    fallbackSlotDurationMinutes: loaded.fallbackSlotDurationMinutes,
    visitDurationMinutes: durationMinutes,
    excludeAppointmentId: id,
    searchFromAppointmentIso: appt.appointment_datetime as string,
    avoidStartIso: appt.appointment_datetime as string,
    ...(dateKey ? { onlyDateKey: dateKey, limit: 200 } : {}),
  });

  return NextResponse.json({ slots, count: slots.length });
}
