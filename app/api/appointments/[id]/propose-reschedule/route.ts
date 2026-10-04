import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  isAllowedProfessionalDuration,
  PROFESSIONAL_DURATION_OPTIONS,
} from "@/lib/professional-appointment-durations";
import { findFirstAlternativeSlotStarts } from "@/lib/find-alternative-appointment-slots";
import { loadDoctorSettingsForSlots } from "@/lib/load-doctor-settings-for-slots";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";
import { fetchBlockingAppointments, toBlockingRows } from "@/lib/appointment-blocking-query";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { appointmentLinkUrl } from "@/lib/appointment-link-token";
import { issueAppointmentLink } from "@/lib/appointment-links-db";
import { sendPatientRescheduleProposalEmail } from "@/lib/send-patient-reschedule-proposal-email";
import { computeProposalExpiresAt } from "@/lib/proposal-expires-at";
import { scheduleSlotRefusal } from "@/lib/schedule-slot-check";
import { createServiceRoleClient } from "@/lib/supabase-service";

type RouteContext = { params: { id: string } };

/** She sends 1 to 3 times (user, 2026-10-04). */
const MAX_PROPOSED_SLOTS = 3;

/**
 * The professional suggests other times for a request she can't take as asked
 * (user, 2026-10-04). Only a REQUESTED row: a confirmed visit can only be cancelled.
 *
 * Body: `{ durationMinutes, proposedSlots?: string[] (UTC ISO, 1-3), locationId? }`.
 * - Each time must be inside the clinic's opening hours and free in her agenda (any
 *   clinic); re-checked here (409 if taken meanwhile).
 * - `locationId`: another of her clinic links; default the request's clinic.
 * - Without `proposedSlots`, the first three free times after the requested one are
 *   used (the picker in the review page sends her own choice).
 * The patient gets a single-use proposal link (appointment_links) valid until the
 * proposal expires (24 h, or 2 h before the first time if sooner).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const id = params.id;
  if (!id) return NextResponse.json({ message: "Missing appointment id." }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const durationMinutes = Number(body.durationMinutes);
  if (!isAllowedProfessionalDuration(durationMinutes)) {
    return NextResponse.json(
      { message: `Invalid durationMinutes. Allowed values (minutes): ${PROFESSIONAL_DURATION_OPTIONS.join(", ")}.` },
      { status: 400 },
    );
  }

  let chosen: string[] | null = null;
  if (body.proposedSlots !== undefined) {
    const raw = Array.isArray(body.proposedSlots) ? body.proposedSlots : [];
    const parsed = raw.map((v) => new Date(String(v)));
    const keys = parsed.map((d) => d.getTime());
    if (
      raw.length < 1 ||
      raw.length > MAX_PROPOSED_SLOTS ||
      keys.some((k) => !Number.isFinite(k)) ||
      new Set(keys).size !== keys.length
    ) {
      return NextResponse.json(
        { message: `Choose between 1 and ${MAX_PROPOSED_SLOTS} different times.` },
        { status: 400 },
      );
    }
    chosen = parsed.sort((a, b) => a.getTime() - b.getTime()).map((d) => d.toISOString());
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Server misconfiguration." }, { status: 503 });

  const { data: doctor } = await service
    .from("professionals")
    .select("id, name")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!doctor?.id) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const { data: appt } = await service
    .from("appointments")
    .select("id, professional_id, patient_name, patient_email, appointment_datetime, status, clinic_id, location_id")
    .eq("id", id)
    .maybeSingle();
  if (!appt) return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  if (appt.professional_id !== doctor.id) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const st = String(appt.status ?? "").toUpperCase();
  if (st !== "REQUESTED") {
    return NextResponse.json(
      {
        message:
          st === "CONFIRMED"
            ? "A confirmed visit can't be moved; you can cancel it instead."
            : "Only a pending request can get new times.",
      },
      { status: 400 },
    );
  }

  // Which clinic: the one she picked (one of hers), else the request's own, else her primary
  // (legacy rows without a clinic; the same fallback as alternative-slots).
  const locations = await loadDoctorLocations(doctor.id);
  const requestedLink = String(body.locationId ?? "").trim();
  const location = requestedLink
    ? locations.find((l) => l.id === requestedLink)
    : locations.find((l) => l.id === appt.location_id) ??
      locations.find((l) => appt.clinic_id && l.clinic_id === appt.clinic_id) ??
      primaryDoctorLocation(locations);
  if (!location || !location.clinic_id) {
    return NextResponse.json({ message: "That clinic isn't one of yours." }, { status: 400 });
  }

  const loaded = await loadDoctorSettingsForSlots(service, doctor.id, location.id);
  if (!loaded) {
    return NextResponse.json({ message: "This clinic is not set up yet. Contact us to set it up." }, { status: 409 });
  }

  const { data: blockingRaw, error: blockErr } = await fetchBlockingAppointments(service, doctor.id);
  if (blockErr) {
    console.error(blockErr);
    return NextResponse.json({ message: "Error loading schedule." }, { status: 500 });
  }
  const blockingRows = toBlockingRows(blockingRaw);
  const now = new Date();

  const slots =
    chosen ??
    findFirstAlternativeSlotStarts({
      settings: loaded.settings,
      weeklySlots: loaded.weeklySlots,
      blockingRows,
      fallbackSlotDurationMinutes: loaded.fallbackSlotDurationMinutes,
      visitDurationMinutes: durationMinutes,
      excludeAppointmentId: id,
      searchFromAppointmentIso: appt.appointment_datetime as string,
      avoidStartIso: appt.appointment_datetime as string,
    }).slice(0, MAX_PROPOSED_SLOTS);
  if (slots.length === 0) {
    return NextResponse.json(
      { message: "No open times found in your booking horizon. Try a shorter visit length." },
      { status: 409 },
    );
  }

  for (const slot of slots) {
    const refusal = scheduleSlotRefusal({
      settingsRow: loaded.settings,
      appointmentUtc: new Date(slot),
      durationMinutes,
      blockingRows,
      excludeAppointmentId: id,
      now,
    });
    if (refusal) {
      return NextResponse.json({ message: refusal.message, code: refusal.code, slot }, { status: refusal.status });
    }
  }

  const proposalExpiresAt = computeProposalExpiresAt(now, slots[0]!);
  const { data: saved, error: updateErr } = await service
    .from("appointments")
    .update({
      status: "NEEDS_RESCHEDULE",
      duration_minutes: durationMinutes,
      proposed_slots: slots,
      proposal_expires_at: proposalExpiresAt.toISOString(),
      proposal_reminder_sent_at: null,
      reschedule_access_token: null,
      clinic_id: location.clinic_id,
      location_id: location.id,
    })
    .eq("id", id)
    .eq("professional_id", doctor.id)
    .eq("status", "REQUESTED")
    .select("id")
    .maybeSingle();
  if (updateErr) {
    console.error("[DocCy] propose-reschedule update failed", updateErr);
    return NextResponse.json({ message: "Could not save the proposal." }, { status: 500 });
  }
  if (!saved) return NextResponse.json({ message: "This request was already answered." }, { status: 409 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  const token = await issueAppointmentLink(service, { appointmentId: id, purpose: "proposal", expiresAt: proposalExpiresAt });
  const slotLabelsCyprus = slots.map((iso) =>
    format(appointmentToCyprusDate(iso), "EEEE, d MMMM yyyy 'at' HH:mm", { locale: enUS }),
  );

  try {
    await sendPatientRescheduleProposalEmail({
      patientEmail: String(appt.patient_email ?? ""),
      patientName: String(appt.patient_name ?? ""),
      chooseUrl: appointmentLinkUrl(siteUrl, "proposal", token),
      proposalExpiresAtIso: proposalExpiresAt.toISOString(),
      doctorName: String(doctor.name ?? ""),
      slotLabelsCyprus,
      resendToOverride: process.env.NODE_ENV !== "production" ? process.env.RESEND_TO_OVERRIDE?.trim() || null : null,
    });
  } catch (e) {
    console.error("[DocCy] Reschedule proposal email failed", e);
  }

  return NextResponse.json({
    message: "Proposal sent to the patient.",
    proposalExpiresAt: proposalExpiresAt.toISOString(),
    slots,
    slotLabelsCyprus,
  });
}
