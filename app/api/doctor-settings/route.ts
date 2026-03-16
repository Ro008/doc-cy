// app/api/doctor-settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** GET ?doctorId=xxx - returns current settings for the doctor */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  if (!doctorId) {
    return NextResponse.json(
      { message: "Missing doctorId." },
      { status: 400 }
    );
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

/** POST - upsert doctor_settings. Body: doctorId, monday..friday, startTime, endTime, slotDurationMinutes */
export async function POST(req: NextRequest) {
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
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    startTime?: string; // "09:00" or "09:00:00"
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
    doctor_id: b.doctorId,
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

  return NextResponse.json({ settings: data }, { status: 200 });
}
