import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { randomUUID } from "crypto";
import {
  isAllowedProfessionalDuration,
  PROFESSIONAL_DURATION_OPTIONS,
} from "@/lib/professional-appointment-durations";
import { candidateOverlapsAnyBlockingInterval } from "@/lib/appointment-overlap";
import { findFirstAlternativeSlotStarts } from "@/lib/find-alternative-appointment-slots";
import { loadDoctorSettingsForSlots } from "@/lib/load-doctor-settings-for-slots";
import {
  fetchBlockingAppointments,
  toBlockingRows,
} from "@/lib/appointment-blocking-query";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { sendPatientRescheduleProposalEmail } from "@/lib/send-patient-reschedule-proposal-email";
import { computeProposalExpiresAt } from "@/lib/proposal-expires-at";

type RouteContext = { params: { id: string } };

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

  const durationMinutes = Number((body as { durationMinutes?: unknown }).durationMinutes);
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
    .from("doctors")
    .select("id, name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorErr || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, patient_email, appointment_datetime, status, duration_minutes"
    )
    .eq("id", id)
    .maybeSingle();

  if (apptErr || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.doctor_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const st = String(appt.status ?? "").toUpperCase();
  if (st !== "REQUESTED") {
    return NextResponse.json(
      { message: "Only pending requests can get a counter-offer." },
      { status: 400 }
    );
  }

  const loaded = await loadDoctorSettingsForSlots(supabase, doctor.id);
  if (!loaded) {
    return NextResponse.json(
      { message: "Professional settings not found." },
      { status: 500 }
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
  const hasConflict = candidateOverlapsAnyBlockingInterval(
    appt.appointment_datetime as string,
    durationMinutes,
    id,
    blockingRows,
    loaded.fallbackSlotDurationMinutes
  );

  if (!hasConflict) {
    return NextResponse.json(
      { message: "There is no schedule conflict for this duration; confirm instead." },
      { status: 400 }
    );
  }

  const slots = findFirstAlternativeSlotStarts({
    settings: loaded.settings,
    weeklySlots: loaded.weeklySlots,
    blockingRows,
    fallbackSlotDurationMinutes: loaded.fallbackSlotDurationMinutes,
    visitDurationMinutes: durationMinutes,
    excludeAppointmentId: id,
    searchFromAppointmentIso: appt.appointment_datetime as string,
    avoidStartIso: appt.appointment_datetime as string,
  });

  if (slots.length < 3) {
    return NextResponse.json(
      {
        message:
          "Could not find three open times in your booking horizon. Try a shorter visit length or adjust availability.",
      },
      { status: 409 }
    );
  }

  const token = randomUUID();
  const three = slots.slice(0, 3);
  const proposalExpiresAt = computeProposalExpiresAt(new Date(), three[0]!);

  const { error: updateErr } = await supabase
    .from("appointments")
    .update({
      status: "NEEDS_RESCHEDULE",
      duration_minutes: durationMinutes,
      proposed_slots: three,
      proposal_expires_at: proposalExpiresAt.toISOString(),
      reschedule_access_token: token,
    })
    .eq("id", id)
    .eq("doctor_id", doctor.id);

  if (updateErr) {
    console.error(updateErr);
    return NextResponse.json(
      { message: "Could not save the proposal." },
      { status: 500 }
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const resendToOverride =
    process.env.NODE_ENV !== "production"
      ? process.env.RESEND_TO_OVERRIDE?.trim() || null
      : null;

  const slotLabelsCyprus = three.map((iso) => {
    const cy = appointmentToCyprusDate(iso);
    return format(cy, "EEEE, d MMMM yyyy 'at' HH:mm", { locale: enUS });
  });

  try {
    await sendPatientRescheduleProposalEmail({
      siteUrl,
      patientEmail: String(appt.patient_email),
      patientName: String(appt.patient_name),
      appointmentId: id,
      rescheduleToken: token,
      proposalExpiresAtIso: proposalExpiresAt.toISOString(),
      doctorName: String(doctor.name ?? ""),
      slotLabelsCyprus,
      resendToOverride,
    });
  } catch (e) {
    console.error("[DocCy] Reschedule proposal email failed", e);
  }

  return NextResponse.json({
    message: "Proposal sent to the patient.",
    proposalExpiresAt: proposalExpiresAt.toISOString(),
    slots: three,
    slotLabelsCyprus,
  });
}
