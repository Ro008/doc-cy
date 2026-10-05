import { formatInTimeZone } from "date-fns-tz";
import { NextRequest, NextResponse } from "next/server";

import { consumeDraftByToken, countOpenRequestsWithProfessional } from "@/lib/appointment-drafts";
import { isAppointmentLinkTokenShape } from "@/lib/appointment-link-token";
import { CY_TZ } from "@/lib/appointments";
import { buildProfessionalNewRequestEmail, sendBuiltEmail } from "@/lib/booking-request-emails";
import { checkOnlineBookingSlot } from "@/lib/online-booking-slot-check";
import { professionalAccountEmail } from "@/lib/professional-account-contact";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * The patient confirms the emailed link (user, 2026-10-02). Body `{ token }`.
 *
 * Uses the link once, re-checks the time (it may have been taken since the form was
 * sent), creates the REQUESTED appointment and only then emails the professional.
 * - 200 { appointment }
 * - 410 { state: "invalid" | "used" | "replaced" | "expired" }
 * - 409 { code: "slot_taken" | "open_request_exists", professionalSlug } (link used up:
 *   the patient picks another time on the profile)
 */
export async function POST(req: NextRequest) {
  const limited = enforcePublicApiRateLimit(req, "bookingConfirm", {
    body: { message: "Too many attempts. Please try again later." },
  });
  if (limited) return limited;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Booking is temporarily unavailable." }, { status: 503 });
  }

  let token: unknown;
  try {
    token = ((await req.json()) as { token?: unknown }).token;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }
  if (!isAppointmentLinkTokenShape(token)) {
    return NextResponse.json({ state: "invalid", message: "This link is not valid." }, { status: 410 });
  }

  let consumed: Awaited<ReturnType<typeof consumeDraftByToken>>;
  try {
    consumed = await consumeDraftByToken(supabase, token);
  } catch (err) {
    console.error("[DocCy] confirm: consume draft", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
  if (consumed.state !== "usable" || !consumed.draft) {
    const message =
      consumed.state === "used"
        ? "This request was already confirmed."
        : consumed.state === "replaced"
          ? "This request was replaced by a newer one. Use the link in your latest email."
          : consumed.state === "expired"
          ? "This link has expired."
          : "This link is not valid.";
    return NextResponse.json({ state: consumed.state, message }, { status: 410 });
  }
  const draft = consumed.draft;

  const { data: professional } = await supabase
    .from("professionals")
    .select("id, name, slug, email, registration_email")
    .eq("id", draft.professional_id)
    .maybeSingle();
  const professionalSlug = (professional as { slug?: string | null } | null)?.slug ?? null;

  const slot = await checkOnlineBookingSlot(supabase, {
    professionalId: draft.professional_id,
    appointmentLocal: formatInTimeZone(new Date(draft.appointment_datetime), CY_TZ, "yyyy-MM-dd'T'HH:mm"),
    clinicId: draft.clinic_id,
  });
  if (!slot.ok) {
    return NextResponse.json({ message: slot.message, code: slot.code, professionalSlug }, { status: slot.status });
  }

  try {
    const open = await countOpenRequestsWithProfessional(supabase, draft.professional_id, draft.patient_email);
    if (open > 0) {
      return NextResponse.json(
        {
          code: "open_request_exists",
          message: "You already have a request waiting with this professional.",
          professionalSlug,
        },
        { status: 409 },
      );
    }
  } catch (err) {
    console.error("[DocCy] confirm: open requests", err);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("appointments")
    .insert({
      professional_id: draft.professional_id,
      clinic_id: draft.clinic_id,
      booking_source: "online",
      patient_name: draft.patient_name,
      patient_email: draft.patient_email,
      patient_phone: draft.patient_phone,
      patient_gender: draft.patient_gender,
      patient_birthdate: draft.patient_birthdate,
      is_new_patient: draft.is_new_patient,
      reason: draft.reason,
      // The trigger re-copies the name while the service exists; if she deleted it in the
      // meantime the id is already null and the draft's copy of the name stays.
      professional_service_id: draft.professional_service_id,
      service_name: draft.service_name,
      appointment_datetime: slot.appointmentUtc.toISOString(),
      duration_minutes: slot.slotDurationMinutes,
      status: "REQUESTED",
      created_at: new Date().toISOString(),
    })
    .select("id, appointment_datetime, status")
    .single();
  if (insertError || !inserted) {
    if ((insertError as { code?: string } | null)?.code === "23505") {
      return NextResponse.json(
        { code: "slot_taken", message: "That time was just booked. Please choose another time.", professionalSlug },
        { status: 409 },
      );
    }
    console.error("[DocCy] confirm: insert appointment", insertError);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
  const appointmentId = String((inserted as { id: string }).id);

  await supabase.from("appointment_drafts").update({ appointment_id: appointmentId }).eq("id", draft.id);

  // The request now reaches the professional. A failed email never undoes the request:
  // it is on her dashboard either way.
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
    await sendBuiltEmail(
      professionalAccountEmail((professional ?? {}) as { email?: string | null; registration_email?: string | null }),
      buildProfessionalNewRequestEmail({
        professionalName: String((professional as { name?: string } | null)?.name ?? ""),
        patientName: draft.patient_name,
        appointmentIso: slot.appointmentUtc.toISOString(),
        reason: draft.reason,
        isNewPatient: draft.is_new_patient,
        clinic: { name: slot.bookingLocation.clinic_name ?? "Clinic", address: slot.bookingLocation.clinic_address },
        reviewUrl: new URL(`/dashboard/appointments/${encodeURIComponent(appointmentId)}`, siteUrl).toString(),
      }),
    );
  } catch (err) {
    console.error("[DocCy] confirm: professional email failed", err);
  }

  return NextResponse.json({ appointment: inserted, professionalSlug }, { status: 200 });
}
