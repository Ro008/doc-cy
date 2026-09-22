import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";
import {
  CONTACT_PHONE_REQUIRED_CODE,
  CONTACT_PHONE_REQUIRED_MESSAGE,
  contactPhoneState,
  anyClinicPaused,
  pauseFlagsAfterChange,
  type ContactPhoneState,
} from "@/lib/booking-contact-phone";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What patients would be left with once `pauseFlags` applies. Tolerates the older
 * schema without professionals.mobile_number / public_phone_source.
 */
async function loadContactPhoneState(
  supabase: SupabaseClient,
  professionalId: string,
  pauseFlags: readonly boolean[],
): Promise<ContactPhoneState> {
  let contact: { phone?: string | null; mobile_number?: string | null } | null = null;
  const withMobile = await supabase
    .from("professionals")
    .select("phone, mobile_number")
    .eq("id", professionalId)
    .maybeSingle();
  if (withMobile.error) {
    const fallback = await supabase
      .from("professionals")
      .select("phone")
      .eq("id", professionalId)
      .maybeSingle();
    contact = fallback.data ?? null;
  } else {
    contact = withMobile.data;
  }

  const settings = await supabase
    .from("professional_settings")
    .select("public_phone_source")
    .eq("professional_id", professionalId)
    .maybeSingle();

  return contactPhoneState({
    pauseFlags,
    mobileNumber: contact?.mobile_number ?? null,
    directoryPhone: contact?.phone ?? null,
    publicPhoneSource: settings.data?.public_phone_source ?? null,
  });
}

/** Pausing the last bookable clinic makes the Call button the only way in. */
async function revealPublicPhone(
  supabase: SupabaseClient,
  professionalId: string,
  source: ContactPhoneState["source"],
): Promise<void> {
  const payload = {
    professional_id: professionalId,
    show_phone_public: true,
    public_phone_source: source,
    updated_at: new Date().toISOString(),
  };
  let upsert = await supabase
    .from("professional_settings")
    .upsert(payload, { onConflict: "professional_id" });
  if (upsert.error && /public_phone_source/i.test(String(upsert.error.message ?? ""))) {
    const { public_phone_source: _source, ...withoutSource } = payload;
    upsert = await supabase
      .from("professional_settings")
      .upsert(withoutSource, { onConflict: "professional_id" });
  }
  if (upsert.error) {
    console.error("[DocCy] Failed to reveal the public phone on pause", upsert.error);
  }
}

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

  const locations = await loadDoctorLocations(supabase, doctor.id);
  const primary = primaryDoctorLocation(locations);
  if (primary) {
    return NextResponse.json(
      { pauseOnlineBookings: Boolean(primary.pause_online_bookings) },
      { status: 200 }
    );
  }

  const { data: settings, error: settingsErr } = await supabase
    .from("professional_settings")
    .select("pause_online_bookings")
    .eq("professional_id", doctor.id)
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

  const locations = await loadDoctorLocations(supabase, doctor.id);
  const requestedLocationId =
    typeof b.locationId === "string" ? b.locationId.trim() : "";
  const target = requestedLocationId
    ? locations.find((row) => row.id === requestedLocationId)
    : primaryDoctorLocation(locations);

  if (requestedLocationId && !target) {
    return NextResponse.json({ message: "Clinic not found." }, { status: 404 });
  }

  // Patients book online or they call. Never let a clinic stop taking bookings while
  // the account has no phone to show, or its patients are left with no way to reach it.
  const nextPauseFlags = target
    ? pauseFlagsAfterChange(
        locations.map((row) => ({
          id: row.id,
          pauseOnlineBookings: Boolean(row.pause_online_bookings),
        })),
        target.id,
        nextPaused,
      )
    : [nextPaused];

  let contact: ContactPhoneState | null = null;
  if (anyClinicPaused(nextPauseFlags)) {
    contact = await loadContactPhoneState(supabase, doctor.id, nextPauseFlags);
    if (contact.needsNumber) {
      return NextResponse.json(
        { message: CONTACT_PHONE_REQUIRED_MESSAGE, code: CONTACT_PHONE_REQUIRED_CODE },
        { status: 400 },
      );
    }
  }

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
    if (contact) {
      await revealPublicPhone(supabase, doctor.id, contact.source);
    }
    return NextResponse.json(
      {
        pauseOnlineBookings: nextPaused,
        locationId: target.id,
        ...(contact
          ? { showPhonePublic: true, callNumber: contact.callNumber }
          : {}),
      },
      { status: 200 }
    );
  }

  const { error: upsertErr } = await supabase
    .from("professional_settings")
    .upsert(
      {
        professional_id: doctor.id,
        pause_online_bookings: nextPaused,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "professional_id" }
    );

  if (upsertErr) {
    return NextResponse.json(
      { message: "Error saving pause state." },
      { status: 500 }
    );
  }

  if (contact) {
    await revealPublicPhone(supabase, doctor.id, contact.source);
  }

  return NextResponse.json(
    {
      pauseOnlineBookings: nextPaused,
      ...(contact ? { showPhonePublic: true, callNumber: contact.callNumber } : {}),
    },
    { status: 200 }
  );
}
