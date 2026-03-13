// app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CY_TZ } from "@/lib/appointments";
import { zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";

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

  const {
    doctorId,
    patientName,
    patientEmail,
    patientPhone,
    appointmentLocal,
  } = body as {
    doctorId?: string;
    patientName?: string;
    patientEmail?: string;
    patientPhone?: string;
    appointmentLocal?: string; // "YYYY-MM-DDTHH:mm" in Europe/Nicosia
  };

  if (
    !doctorId ||
    !patientName ||
    !patientEmail ||
    !patientPhone ||
    !appointmentLocal
  ) {
    return NextResponse.json(
      { message: "Missing required fields." },
      { status: 400 }
    );
  }

  // Interpret appointmentLocal as local Europe/Nicosia time and convert to UTC
  let appointmentUtc: Date;
  try {
    appointmentUtc = zonedTimeToUtc(appointmentLocal, CY_TZ);
  } catch {
    return NextResponse.json(
      { message: "Invalid appointmentLocal value." },
      { status: 400 }
    );
  }

  if (Number.isNaN(appointmentUtc.getTime())) {
    return NextResponse.json(
      { message: "Invalid appointmentLocal value." },
      { status: 400 }
    );
  }

  // Verify requested time is within one of the doctor's weekly slots
  const cyLocal = utcToZonedTime(appointmentUtc, CY_TZ);
  const dayOfWeek = cyLocal.getDay(); // 0-6
  const hours = cyLocal.getHours();
  const minutes = cyLocal.getMinutes();
  const hhmmss = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:00`;

  const { data: slots, error: slotsError } = await supabase
    .from("slots")
    .select("id, start_time, end_time")
    .eq("doctor_id", doctorId)
    .eq("day_of_week", dayOfWeek);

  if (slotsError) {
    console.error(slotsError);
    return NextResponse.json(
      { message: "Error checking availability." },
      { status: 500 }
    );
  }

  const withinSlot = (slots ?? []).some((s) => {
    return s.start_time <= hhmmss && hhmmss < s.end_time;
  });

  if (!withinSlot) {
    return NextResponse.json(
      { message: "Requested time is outside the doctor's availability." },
      { status: 400 }
    );
  }

  // Check if there is already an appointment at exactly this time for this doctor
  const { data: existing, error: existingError } = await supabase
    .from("appointments")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("appointment_datetime", appointmentUtc.toISOString())
    .limit(1);

  if (existingError) {
    console.error(existingError);
    return NextResponse.json(
      { message: "Error checking existing appointments." },
      { status: 500 }
    );
  }

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { message: "Slot already taken." },
      { status: 409 }
    );
  }

  // Insert appointment with status 'confirmed' (MVP: auto-confirm)
  const { data: inserted, error: insertError } = await supabase
    .from("appointments")
    .insert({
      doctor_id: doctorId,
      patient_name: patientName,
      patient_email: patientEmail,
      patient_phone: patientPhone,
      appointment_datetime: appointmentUtc.toISOString(),
      status: "confirmed",
    })
    .select("id, appointment_datetime, status")
    .single();

  if (insertError) {
    console.error(insertError);

    // Handle potential race condition via unique constraint
    const code = (insertError as any)?.code;
    if (code === "23505") {
      return NextResponse.json(
        { message: "Slot already taken." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "Error creating appointment." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      appointment: inserted,
      message: "Appointment booked successfully.",
    },
    { status: 201 }
  );
}

