import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { isCyprusDistrict } from "@/lib/cyprus-districts";
import {
  clinicLocationFromParts,
  hasConfirmedClinicCoordinates,
} from "@/lib/clinic-location";
import { parseOptionalCoordinates } from "@/lib/finder-distance";
import {
  DOCTOR_LOCATION_SELECT,
  MAX_DOCTOR_LOCATIONS,
  locationScheduleColumns,
  sanitizeClinicLabel,
  type DoctorLocationRow,
} from "@/lib/doctor-locations";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";

async function requireOwnedDoctor(
  supabase: ReturnType<typeof createRouteHandlerClient>,
  doctorId: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ message: "Unauthorized." }, { status: 401 }) };
  const { data: owned, error } = await supabase
    .from("professionals")
    .select("id")
    .eq("id", doctorId)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || !owned) {
    return { error: NextResponse.json({ message: "Forbidden." }, { status: 403 }) };
  }
  return { user, doctorId };
}

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const doctorId = new URL(req.url).searchParams.get("doctorId") ?? "";
  if (!doctorId) {
    return NextResponse.json({ message: "Missing doctorId." }, { status: 400 });
  }
  const owned = await requireOwnedDoctor(supabase, doctorId);
  if ("error" in owned && owned.error) return owned.error;

  const locations = await loadDoctorLocations(supabase, doctorId);
  return NextResponse.json({ locations }, { status: 200 });
}

/** Create an extra clinic, copying schedule from the primary location. */
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }
  const doctorId = String((body as { doctorId?: string }).doctorId ?? "").trim();
  if (!doctorId) {
    return NextResponse.json({ message: "Missing doctorId." }, { status: 400 });
  }
  const owned = await requireOwnedDoctor(supabase, doctorId);
  if ("error" in owned && owned.error) return owned.error;

  const existing = await loadDoctorLocations(supabase, doctorId);
  if (existing.length >= MAX_DOCTOR_LOCATIONS) {
    return NextResponse.json(
      { message: `You can add up to ${MAX_DOCTOR_LOCATIONS} clinics.` },
      { status: 400 },
    );
  }

  const primary = primaryDoctorLocation(existing);
  const nextOrder =
    existing.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0) + 1;

  const insertRow: Record<string, unknown> = {
    doctor_id: doctorId,
    is_primary: existing.length === 0,
    sort_order: nextOrder,
    pause_online_bookings: false,
  };

  if (primary) {
    insertRow.monday = primary.monday;
    insertRow.tuesday = primary.tuesday;
    insertRow.wednesday = primary.wednesday;
    insertRow.thursday = primary.thursday;
    insertRow.friday = primary.friday;
    insertRow.saturday = primary.saturday;
    insertRow.sunday = primary.sunday;
    insertRow.start_time = primary.start_time;
    insertRow.end_time = primary.end_time;
    insertRow.weekly_schedule = primary.weekly_schedule;
    insertRow.break_start = primary.break_start;
    insertRow.break_end = primary.break_end;
    insertRow.slot_duration_minutes = primary.slot_duration_minutes;
  }

  const { data, error } = await supabase
    .from("doctor_locations")
    .insert(insertRow)
    .select(DOCTOR_LOCATION_SELECT)
    .single();

  if (error || !data) {
    console.error("[DocCy] create doctor location failed:", error);
    return NextResponse.json({ message: "Could not add clinic." }, { status: 500 });
  }

  return NextResponse.json({ location: data as DoctorLocationRow }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const b = body as {
    doctorId?: string;
    locationId?: string;
    district?: string | null;
    clinicAddress?: string | null;
    clinicLatitude?: number | null;
    clinicLongitude?: number | null;
    clinicPlaceId?: string | null;
    town?: string | null;
    label?: string | null;
    weeklySchedule?: DoctorLocationRow["weekly_schedule"];
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    saturday?: boolean;
    sunday?: boolean;
    breakEnabled?: boolean;
    breakStart?: string;
    breakEnd?: string;
    slotDurationMinutes?: number;
    pauseOnlineBookings?: boolean;
  };

  const doctorId = String(b.doctorId ?? "").trim();
  const locationId = String(b.locationId ?? "").trim();
  if (!doctorId || !locationId) {
    return NextResponse.json({ message: "Missing doctorId or locationId." }, { status: 400 });
  }
  const owned = await requireOwnedDoctor(supabase, doctorId);
  if ("error" in owned && owned.error) return owned.error;

  const { data: existing, error: existingErr } = await supabase
    .from("doctor_locations")
    .select("id, doctor_id")
    .eq("id", locationId)
    .eq("doctor_id", doctorId)
    .maybeSingle();
  if (existingErr || !existing) {
    return NextResponse.json({ message: "Clinic not found." }, { status: 404 });
  }

  const districtRaw = typeof b.district === "string" ? b.district.trim() : "";
  const clinicAddress =
    typeof b.clinicAddress === "string" ? b.clinicAddress.trim() : "";
  if (clinicAddress && districtRaw && !isCyprusDistrict(districtRaw)) {
    return NextResponse.json({ message: "Select a valid district." }, { status: 400 });
  }

  const clinicLocation = clinicLocationFromParts({
    address: clinicAddress,
    latitude: b.clinicLatitude,
    longitude: b.clinicLongitude,
    placeId: b.clinicPlaceId,
    district: districtRaw,
    town: typeof b.town === "string" ? b.town : null,
  });
  const coords = parseOptionalCoordinates(b.clinicLatitude, b.clinicLongitude);
  const hasLegacyAddressOnly =
    clinicAddress.length > 0 &&
    !coords &&
    typeof b.clinicLatitude === "undefined" &&
    typeof b.clinicLongitude === "undefined";
  if (clinicAddress && !hasConfirmedClinicCoordinates(clinicLocation) && !hasLegacyAddressOnly) {
    return NextResponse.json(
      { message: "Please select your clinic from the Google suggestions." },
      { status: 400 },
    );
  }

  const schedule = locationScheduleColumns({
    weeklySchedule: b.weeklySchedule as ReturnType<typeof locationScheduleColumns>["weekly_schedule"],
    monday: b.monday,
    tuesday: b.tuesday,
    wednesday: b.wednesday,
    thursday: b.thursday,
    friday: b.friday,
    saturday: b.saturday,
    sunday: b.sunday,
    breakEnabled: b.breakEnabled,
    breakStart: b.breakStart,
    breakEnd: b.breakEnd,
    slotDurationMinutes: b.slotDurationMinutes,
    pauseOnlineBookings: b.pauseOnlineBookings,
  });

  const patch: Record<string, unknown> = {
    ...schedule,
    district: districtRaw || clinicLocation.district,
    clinic_address: clinicAddress || null,
    town: clinicAddress ? clinicLocation.town : null,
    latitude: clinicAddress ? clinicLocation.latitude : null,
    longitude: clinicAddress ? clinicLocation.longitude : null,
    clinic_place_id: clinicAddress ? clinicLocation.placeId : null,
    updated_at: new Date().toISOString(),
  };
  if (typeof b.label === "string") {
    patch.label = sanitizeClinicLabel(b.label);
  }

  const { data, error } = await supabase
    .from("doctor_locations")
    .update(patch)
    .eq("id", locationId)
    .eq("doctor_id", doctorId)
    .select(DOCTOR_LOCATION_SELECT)
    .single();

  if (error || !data) {
    console.error("[DocCy] update doctor location failed:", error);
    return NextResponse.json({ message: "Could not save clinic." }, { status: 500 });
  }

  return NextResponse.json({ location: data as DoctorLocationRow }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const doctorId = String(url.searchParams.get("doctorId") ?? "").trim();
  const locationId = String(url.searchParams.get("locationId") ?? "").trim();
  if (!doctorId || !locationId) {
    return NextResponse.json({ message: "Missing doctorId or locationId." }, { status: 400 });
  }
  const owned = await requireOwnedDoctor(supabase, doctorId);
  if ("error" in owned && owned.error) return owned.error;

  const existing = await loadDoctorLocations(supabase, doctorId);
  const target = existing.find((row) => row.id === locationId);
  if (!target) {
    return NextResponse.json({ message: "Clinic not found." }, { status: 404 });
  }
  if (existing.length <= 1 || target.is_primary) {
    return NextResponse.json(
      { message: "Keep at least one clinic. The first clinic cannot be removed." },
      { status: 400 },
    );
  }

  const { count, error: countErr } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("location_id", locationId)
    .in("status", ["REQUESTED", "CONFIRMED"]);
  if (countErr) {
    console.error("[DocCy] location appointment count failed:", countErr);
    return NextResponse.json({ message: "Could not remove clinic." }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { message: "This clinic has upcoming or requested appointments, so it cannot be removed yet." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("doctor_locations")
    .delete()
    .eq("id", locationId)
    .eq("doctor_id", doctorId)
    .eq("is_primary", false);

  if (error) {
    console.error("[DocCy] delete doctor location failed:", error);
    return NextResponse.json({ message: "Could not remove clinic." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
