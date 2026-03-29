import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { candidateOverlapsAnyBlockingInterval } from "@/lib/appointment-overlap";
import {
  fetchBlockingAppointments,
  toBlockingRows,
} from "@/lib/appointment-blocking-query";
import { sendPatientAppointmentConfirmedEmail } from "@/lib/send-patient-appointment-confirmed-email";

type RouteContext = { params: { id: string } };

function parseProposedSlots(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function matchesProposedSlot(selectedIso: string, proposed: string[]): boolean {
  const t = new Date(selectedIso).getTime();
  if (Number.isNaN(t)) return false;
  return proposed.some((p) => {
    const u = new Date(p).getTime();
    return !Number.isNaN(u) && Math.abs(u - t) <= 60_000;
  });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ message: "Missing appointment id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const token = String((body as { token?: unknown }).token ?? "").trim();
  const selectedStartIso = String(
    (body as { selectedStartIso?: unknown }).selectedStartIso ?? ""
  ).trim();

  if (!token || !selectedStartIso) {
    return NextResponse.json(
      { message: "Missing token or selectedStartIso." },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Server misconfiguration." }, { status: 503 });
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, patient_email, appointment_datetime, status, duration_minutes, reason, proposed_slots, proposal_expires_at, reschedule_access_token"
    )
    .eq("id", id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  const rowToken = (appt as { reschedule_access_token?: string | null })
    .reschedule_access_token;
  if (!rowToken || rowToken !== token) {
    return NextResponse.json({ message: "Invalid or expired link." }, { status: 403 });
  }

  const st = String(appt.status ?? "").toUpperCase();
  if (st !== "NEEDS_RESCHEDULE") {
    return NextResponse.json(
      { message: "This visit is no longer waiting for a new time." },
      { status: 400 }
    );
  }

  const exp = (appt as { proposal_expires_at?: string | null }).proposal_expires_at;
  if (!exp || new Date(exp).getTime() <= Date.now()) {
    return NextResponse.json(
      { message: "This offer has expired. Please book again from the profile page." },
      { status: 410 }
    );
  }

  const proposed = parseProposedSlots(
    (appt as { proposed_slots?: unknown }).proposed_slots
  );
  if (!matchesProposedSlot(selectedStartIso, proposed)) {
    return NextResponse.json(
      { message: "That time is not one of the offered options." },
      { status: 400 }
    );
  }

  const doctorId = appt.doctor_id as string;
  const durationMinutes = Number(
    (appt as { duration_minutes?: number | null }).duration_minutes ?? 30
  );
  const dm = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30;

  const { data: settings } = await supabase
    .from("doctor_settings")
    .select("slot_duration_minutes")
    .eq("doctor_id", doctorId)
    .maybeSingle();

  const fallback =
    (settings as { slot_duration_minutes?: number | null } | null)
      ?.slot_duration_minutes ?? 30;

  const { data: blockingRaw, error: blockErr } = await fetchBlockingAppointments(
    supabase,
    doctorId
  );
  if (blockErr) {
    console.error(blockErr);
    return NextResponse.json({ message: "Error checking schedule." }, { status: 500 });
  }

  const blockingRows = toBlockingRows(blockingRaw);
  const overlap = candidateOverlapsAnyBlockingInterval(
    selectedStartIso,
    dm,
    id,
    blockingRows,
    fallback
  );

  if (overlap) {
    return NextResponse.json(
      { message: "That time is no longer available. Please pick another option." },
      { status: 409 }
    );
  }

  const { error: updateErr } = await supabase
    .from("appointments")
    .update({
      status: "CONFIRMED",
      appointment_datetime: selectedStartIso,
      duration_minutes: dm,
      proposed_slots: [],
      proposal_expires_at: null,
      reschedule_access_token: null,
    })
    .eq("id", id)
    .eq("doctor_id", doctorId);

  if (updateErr) {
    console.error(updateErr);
    return NextResponse.json({ message: "Could not confirm this time." }, { status: 500 });
  }

  const { data: doctor } = await supabase
    .from("doctors")
    .select("name, phone, specialty, clinic_address")
    .eq("id", doctorId)
    .maybeSingle();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const resendToOverride =
    process.env.NODE_ENV !== "production"
      ? process.env.RESEND_TO_OVERRIDE?.trim() || null
      : null;

  try {
    await sendPatientAppointmentConfirmedEmail({
      siteUrl,
      patientEmail: String(appt.patient_email),
      patientName: String(appt.patient_name),
      appointmentId: id,
      appointmentDatetimeIso: selectedStartIso,
      durationMinutes: dm,
      reason: (appt as { reason?: string | null }).reason ?? null,
      doctor: {
        name: doctor?.name,
        specialty: (doctor as { specialty?: string | null } | null)?.specialty,
        phone: (doctor as { phone?: string | null } | null)?.phone,
        clinic_address: (doctor as { clinic_address?: string | null } | null)
          ?.clinic_address,
      },
      resendToOverride,
    });
  } catch (e) {
    console.error("[DocCy] Patient confirmation after reschedule failed", e);
  }

  return NextResponse.json({
    message: "Your visit is confirmed.",
    appointment: {
      id,
      appointment_datetime: selectedStartIso,
      duration_minutes: dm,
      status: "CONFIRMED",
    },
  });
}
