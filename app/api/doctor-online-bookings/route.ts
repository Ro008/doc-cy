import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";
import { writeClinicSettings } from "@/lib/professional-clinic-settings-writes";
import { resumeOnlineBookingsPermission } from "@/lib/booking-permission";

export async function GET() {
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

  if (doctorErr) {
    return NextResponse.json(
      { message: "Error fetching professional." },
      { status: 500 }
    );
  }
  if (!doctor) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  // The pause lives on each clinic link (Point E6); without a clinic nothing is bookable.
  const primary = primaryDoctorLocation(await loadDoctorLocations(doctor.id));
  return NextResponse.json(
    { pauseOnlineBookings: primary ? Boolean(primary.pause_online_bookings) : true },
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
    .from("professionals")
    .select("id, is_registered, pro_access_until")
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

  // Pausing is always allowed; switching bookings back on needs live access (user, 2026-10-02).
  if (!nextPaused) {
    const permission = resumeOnlineBookingsPermission({
      isRegistered: Boolean((doctor as { is_registered?: boolean }).is_registered),
      proAccessUntil: (doctor as { pro_access_until?: string | null }).pro_access_until ?? null,
    });
    if (!permission.allowed) {
      return NextResponse.json(
        {
          message: "Your DocCy access has ended, so online bookings can't be switched on.",
          code: permission.reason,
        },
        { status: 403 },
      );
    }
  }

  const locations = await loadDoctorLocations(doctor.id);
  const requestedLocationId =
    typeof b.locationId === "string" ? b.locationId.trim() : "";
  const target = requestedLocationId
    ? locations.find((row) => row.id === requestedLocationId)
    : primaryDoctorLocation(locations);

  if (requestedLocationId && !target) {
    return NextResponse.json({ message: "Clinic not found." }, { status: 404 });
  }
  if (!target) {
    return NextResponse.json(
      { message: "This clinic is not set up yet. Contact us to set it up." },
      { status: 409 }
    );
  }

  // Paused or not, patients can call the clinic's phone (user, 2026-09-29): pausing
  // needs no number from the professional.
  // The pause is this professional's setting at this clinic: it lives on their join row.
  const saved = await writeClinicSettings(doctor.id, target.id, {
    pause_online_bookings: nextPaused,
  });
  if (!saved.ok) {
    console.error("[DocCy] Failed to save clinic pause state", saved.error);
    return NextResponse.json(
      { message: "Error saving pause state." },
      { status: 500 }
    );
  }
  return NextResponse.json(
    {
      pauseOnlineBookings: nextPaused,
      locationId: target.id,
    },
    { status: 200 }
  );
}
