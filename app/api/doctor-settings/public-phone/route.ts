import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  callNumberForSource,
  parsePublicPhoneSource,
  publicPhoneSourceForSave,
} from "@/lib/public-call-phone";

/** Instant save for the public Call switch (and which number it uses). */
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

  const b = body as {
    showPhonePublic?: unknown;
    publicPhoneSource?: unknown;
  };
  const showProvided = typeof b.showPhonePublic === "boolean";
  const sourceProvided = b.publicPhoneSource !== undefined;
  if (!showProvided && !sourceProvided) {
    return NextResponse.json(
      { message: "Missing showPhonePublic or publicPhoneSource." },
      { status: 400 },
    );
  }

  let doctor: { id: string; phone?: string | null; mobile_number?: string | null } | null =
    null;
  const withMobile = await supabase
    .from("professionals")
    .select("id, phone, mobile_number")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (withMobile.error) {
    const msg = String(withMobile.error.message ?? "");
    if (withMobile.error.code === "42703" || /mobile_number/i.test(msg)) {
      const fallback = await supabase
        .from("professionals")
        .select("id, phone")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (fallback.error) {
        return NextResponse.json(
          { message: "Error fetching professional." },
          { status: 500 },
        );
      }
      doctor = fallback.data
        ? { id: String(fallback.data.id), phone: fallback.data.phone, mobile_number: null }
        : null;
    } else {
      return NextResponse.json(
        { message: "Error fetching professional." },
        { status: 500 },
      );
    }
  } else {
    doctor = withMobile.data;
  }

  if (!doctor) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const existing = await supabase
    .from("doctor_settings")
    .select("show_phone_public, public_phone_source")
    .eq("doctor_id", doctor.id)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json(
      { message: "Error fetching settings." },
      { status: 500 },
    );
  }

  const mobileNumber = String(doctor.mobile_number ?? "").trim();
  const directoryPhone = String(doctor.phone ?? "").trim();
  const nextShow = showProvided
    ? Boolean(b.showPhonePublic)
    : Boolean(existing.data?.show_phone_public);
  const nextSource = publicPhoneSourceForSave({
    showPhonePublic: nextShow,
    selected: sourceProvided
      ? parsePublicPhoneSource(b.publicPhoneSource)
      : parsePublicPhoneSource(existing.data?.public_phone_source),
    mobileNumber,
    directoryPhone: directoryPhone || null,
  });

  if (
    nextShow &&
    callNumberForSource({
      source: nextSource,
      mobileNumber,
      directoryPhone,
    }).length === 0
  ) {
    return NextResponse.json(
      { message: "Save your phone number first, then turn this on." },
      { status: 400 },
    );
  }

  const payload = {
    doctor_id: doctor.id,
    show_phone_public: nextShow,
    public_phone_source: nextSource,
    updated_at: new Date().toISOString(),
  };

  let upsert = await supabase
    .from("doctor_settings")
    .upsert(payload, { onConflict: "doctor_id" });

  if (upsert.error && /public_phone_source/i.test(String(upsert.error.message ?? ""))) {
    const { public_phone_source: _source, ...withoutSource } = payload;
    upsert = await supabase
      .from("doctor_settings")
      .upsert(withoutSource, { onConflict: "doctor_id" });
  }

  if (upsert.error) {
    console.error("[DocCy] Failed to save public Call setting", upsert.error);
    return NextResponse.json(
      { message: "Error saving Call button setting." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { showPhonePublic: nextShow, publicPhoneSource: nextSource },
    { status: 200 },
  );
}
