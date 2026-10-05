// app/api/appointments/route.ts
import { NextRequest, NextResponse } from "next/server";

import { emailClinicFromLocation } from "@/lib/appointment-clinic-copy";
import { appointmentLinkUrl } from "@/lib/appointment-link-token";
import {
  bookingLimitRefusal,
  countOpenRequestsWithProfessional,
  countRecentDrafts,
  createAppointmentDraft,
} from "@/lib/appointment-drafts";
import { parseBookingPatientFields } from "@/lib/booking-patient-fields";
import { buildBookingConfirmLinkEmail, sendBuiltEmail } from "@/lib/booking-request-emails";
import { checkOnlineBookingSlot } from "@/lib/online-booking-slot-check";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { resolveRequestedService } from "@/lib/requested-service";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * A patient submits the online booking form (user, 2026-10-02).
 *
 * This creates a draft, not an appointment: the patient gets an email with a 30-minute,
 * single-use link, and only confirming it (POST /api/booking/confirm) creates the
 * REQUESTED appointment and tells the professional. A draft holds no time.
 *
 * 202 { status: "check_email" } on success.
 */
export async function POST(req: NextRequest) {
  const limited = enforcePublicApiRateLimit(req, "appointments", {
    body: { message: "Too many booking attempts. Please try again later." },
  });
  if (limited) return limited;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { message: "Server is not configured for booking (missing SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  let professionalId = String(body.doctorId ?? "").trim();
  // Tests and clients may pass the profile slug instead of the id.
  const slug = String(body.doctorSlug ?? "").trim();
  if (!professionalId && slug) {
    const { data } = await supabase
      .from("professionals")
      .select("id")
      .eq("slug", slug)
      .eq("is_registered", true)
      .maybeSingle();
    if (!data) {
      return NextResponse.json({ message: "Professional not found for provided slug." }, { status: 400 });
    }
    professionalId = String((data as { id: string }).id);
  }
  const appointmentLocal = String(body.appointmentLocal ?? "").trim();
  if (!professionalId || !appointmentLocal) {
    return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
  }

  const parsed = parseBookingPatientFields(body, "online");
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });
  const fields = parsed.fields;
  const patientEmail = fields.patientEmail!;

  // Optional: one of her services (user, 2026-10-04).
  let professionalServiceId: string | null = null;
  try {
    const requested = await resolveRequestedService(supabase, professionalId, body.professionalServiceId);
    if (!requested.ok) return NextResponse.json({ message: requested.message, code: "invalid_service" }, { status: 400 });
    professionalServiceId = requested.service?.id ?? null;
  } catch (err) {
    console.error("[DocCy] booking service check", err);
    return NextResponse.json({ message: "Error checking your request." }, { status: 500 });
  }

  const slot = await checkOnlineBookingSlot(supabase, {
    professionalId,
    appointmentLocal,
    locationId: typeof body.locationId === "string" ? body.locationId : null,
  });
  if (!slot.ok) {
    const out: Record<string, unknown> = { message: slot.message, code: slot.code };
    if (slot.debug !== undefined) out.debug = slot.debug;
    return NextResponse.json(out, { status: slot.status });
  }

  try {
    const [draftsLastHourForEmail, draftsLastHourForPhone, openRequestsWithProfessional] = await Promise.all([
      countRecentDrafts(supabase, { patientEmail }),
      countRecentDrafts(supabase, { patientPhone: fields.patientPhone }),
      countOpenRequestsWithProfessional(supabase, professionalId, patientEmail),
    ]);
    const refusal = bookingLimitRefusal({
      draftsLastHourForEmail,
      draftsLastHourForPhone,
      openRequestsWithProfessional,
    });
    if (refusal) {
      return NextResponse.json(
        { message: refusal.message, code: refusal.code },
        { status: refusal.code === "too_many_requests" ? 429 : 409 },
      );
    }
  } catch (err) {
    console.error("[DocCy] booking limits", err);
    return NextResponse.json({ message: "Error checking your request." }, { status: 500 });
  }

  const clinicId = slot.bookingLocation.clinic_id;
  if (!clinicId) {
    return NextResponse.json({ message: "Bookings temporarily unavailable" }, { status: 403 });
  }

  let token: string;
  try {
    ({ token } = await createAppointmentDraft(supabase, {
      ...fields,
      patientEmail,
      professionalId,
      clinicId,
      appointmentUtc: slot.appointmentUtc,
      durationMinutes: slot.slotDurationMinutes,
      professionalServiceId,
    }));
  } catch (err) {
    console.error("[DocCy] draft insert", err);
    return NextResponse.json({ message: "Error saving your request." }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
  try {
    const { data: professional } = await supabase
      .from("professionals")
      .select("name")
      .eq("id", professionalId)
      .single();
    await sendBuiltEmail(
      patientEmail,
      buildBookingConfirmLinkEmail({
        patientName: fields.patientName,
        professionalName: String((professional as { name?: string } | null)?.name ?? ""),
        appointmentIso: slot.appointmentUtc.toISOString(),
        clinic: emailClinicFromLocation(slot.bookingLocation),
        confirmUrl: appointmentLinkUrl(siteUrl, "confirm", token),
      }),
    );
  } catch (err) {
    // The draft exists; without the email the patient can simply submit again.
    console.error("[DocCy] booking confirm-link email failed", err);
    return NextResponse.json(
      { message: "We couldn't send the confirmation email. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { status: "check_email", message: "Check your email to confirm your request." },
    { status: 202 },
  );
}
