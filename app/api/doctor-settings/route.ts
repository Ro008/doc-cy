// app/api/doctor-settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { validateSpecialtySubmission } from "@/lib/specialty-submission";
import { isMasterSpecialty } from "@/lib/cyprus-specialties";
import { validateLanguageSelection } from "@/lib/cyprus-languages";

/** GET ?doctorId=xxx - returns current settings for the doctor (authenticated owner only) */
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  if (!doctorId) {
    return NextResponse.json(
      { message: "Missing doctorId." },
      { status: 400 }
    );
  }

  const { data: owned, error: ownErr } = await supabase
    .from("doctors")
    .select("id")
    .eq("id", doctorId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (ownErr || !owned) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("doctor_settings")
    .select("*")
    .eq("doctor_id", doctorId)
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      return NextResponse.json({ settings: null }, { status: 200 });
    }
    console.error(error);
    return NextResponse.json(
      { message: "Error fetching settings." },
      { status: 500 }
    );
  }

  return NextResponse.json({ settings: data });
}

/** POST - upsert doctor_settings + update doctors.phone, specialty, languages (owner only) */
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

  const b = body as {
    doctorId?: string;
    doctorPhone?: string | null;
    specialty?: string;
    /** true when chosen from master list (JSON boolean) */
    specialtyFromMaster?: boolean | string | number;
    languages?: unknown;
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    startTime?: string;
    endTime?: string;
    breakEnabled?: boolean;
    breakStart?: string;
    breakEnd?: string;
    slotDurationMinutes?: number;
  };

  if (!b.doctorId) {
    return NextResponse.json(
      { message: "Missing doctorId." },
      { status: 400 }
    );
  }

  const doctorId = b.doctorId;

  const { data: owned, error: ownErr } = await supabase
    .from("doctors")
    .select("id")
    .eq("id", doctorId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (ownErr || !owned) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const specialtyRaw =
    typeof b.specialty === "string" ? b.specialty.trim() : "";
  let fromMasterFlag =
    b.specialtyFromMaster === true ||
    b.specialtyFromMaster === "true" ||
    b.specialtyFromMaster === 1;
  if (b.specialtyFromMaster === undefined || b.specialtyFromMaster === null) {
    fromMasterFlag = isMasterSpecialty(specialtyRaw);
  }
  const specResult = validateSpecialtySubmission(
    specialtyRaw,
    fromMasterFlag
  );
  if (specResult.ok === false) {
    return NextResponse.json({ message: specResult.message }, { status: 400 });
  }

  const langsParsed = validateLanguageSelection(b.languages);
  if (langsParsed.ok === false) {
    return NextResponse.json({ message: langsParsed.message }, { status: 400 });
  }
  const languages = langsParsed.value;

  const toTime = (v: string | undefined, fallback: string) => {
    if (!v || typeof v !== "string") return fallback;
    const parts = v.trim().split(":");
    const h = parts[0]?.padStart(2, "0") ?? "09";
    const m = parts[1]?.padStart(2, "0") ?? "00";
    return `${h}:${m}:00`;
  };

  const slotMinutes = Number(b.slotDurationMinutes);
  const duration =
    Number.isInteger(slotMinutes) && slotMinutes > 0 ? slotMinutes : 30;

  const payload = {
    doctor_id: doctorId,
    monday: Boolean(b.monday),
    tuesday: Boolean(b.tuesday),
    wednesday: Boolean(b.wednesday),
    thursday: Boolean(b.thursday),
    friday: Boolean(b.friday),
    start_time: toTime(b.startTime, "09:00:00"),
    end_time: toTime(b.endTime, "17:00:00"),
    break_start: b.breakEnabled ? toTime(b.breakStart, "13:00:00") : null,
    break_end: b.breakEnabled ? toTime(b.breakEnd, "14:00:00") : null,
    slot_duration_minutes: duration,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("doctor_settings")
    .upsert(payload, {
      onConflict: "doctor_id",
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Error saving settings." },
      { status: 500 }
    );
  }

  const phoneUpdate: {
    phone?: string | null;
    specialty: string;
    languages: string[];
    is_specialty_approved: boolean;
  } = {
    specialty: specResult.specialty,
    languages,
    is_specialty_approved: specResult.is_specialty_approved,
  };
  if (b.doctorPhone !== undefined) {
    const trimmed =
      typeof b.doctorPhone === "string" ? b.doctorPhone.trim() : "";
    phoneUpdate.phone = trimmed ? trimmed : null;
  }

  const { error: docErr } = await supabase
    .from("doctors")
    .update(phoneUpdate)
    .eq("id", doctorId);

  if (docErr) {
    console.error("[DocCy] Failed to update doctors row", docErr);
    return NextResponse.json(
      {
        message:
          docErr.message?.includes("languages") || docErr.code === "42703"
            ? "Database missing `languages` column. Run supabase/doctors_add_languages.sql in Supabase."
            : "Error updating professional profile.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ settings: data }, { status: 200 });
}
