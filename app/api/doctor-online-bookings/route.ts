import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";

export async function GET() {
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

  if (doctorErr) {
    return NextResponse.json(
      { message: "Error fetching professional." },
      { status: 500 }
    );
  }
  if (!doctor) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const locations = await loadDoctorLocations(supabase, doctor.id);
  const primary = primaryDoctorLocation(locations);
  if (primary) {
    return NextResponse.json(
      { pauseOnlineBookings: Boolean(primary.pause_online_bookings) },
      { status: 200 }
    );
  }

  const { data: settings, error: settingsErr } = await supabase
    .from("doctor_settings")
    .select("pause_online_bookings")
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  if (settingsErr) {
    return NextResponse.json(
      { message: "Error fetching availability pause state." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { pauseOnlineBookings: Boolean(settings?.pause_online_bookings) },
    { status: 200 }
  );
}

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
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const b = body as { pauseOnlineBookings?: unknown; locationId?: unknown };
  const nextPaused =
    typeof b.pauseOnlineBookings === "boolean"
      ? b.pauseOnlineBookings
      : undefined;

  if (nextPaused === undefined) {
    return NextResponse.json(
      { message: "Missing pauseOnlineBookings boolean." },
      { status: 400 }
    );
  }

  const { data: doctor, error: doctorErr } = await supabase
    .from("doctors")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr) {
    return NextResponse.json(
      { message: "Error fetching professional." },
      { status: 500 }
    );
  }
  if (!doctor) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const locations = await loadDoctorLocations(supabase, doctor.id);
  const requestedLocationId =
    typeof b.locationId === "string" ? b.locationId.trim() : "";
  const target =
    (requestedLocationId
      ? locations.find((row) => row.id === requestedLocationId)
      : null) ?? primaryDoctorLocation(locations);

  if (target) {
    const { error: locationErr } = await supabase
      .from("doctor_locations")
      .update({
        pause_online_bookings: nextPaused,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .eq("doctor_id", doctor.id);
    if (locationErr) {
      return NextResponse.json(
        { message: "Error saving pause state." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { pauseOnlineBookings: nextPaused, locationId: target.id },
      { status: 200 }
    );
  }

  const { error: upsertErr } = await supabase
    .from("doctor_settings")
    .upsert(
      {
        doctor_id: doctor.id,
        pause_online_bookings: nextPaused,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doctor_id" }
    );

  if (upsertErr) {
    return NextResponse.json(
      { message: "Error saving pause state." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { pauseOnlineBookings: nextPaused },
    { status: 200 }
  );
}
