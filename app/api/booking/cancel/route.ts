import { NextRequest, NextResponse } from "next/server";

import { consumeAppointmentLink } from "@/lib/appointment-links-db";
import { buildProfessionalPatientCancelledEmail, sendBuiltEmail } from "@/lib/booking-request-emails";
import { loadPatientCancelContext } from "@/lib/patient-cancel";
import { professionalAccountEmail } from "@/lib/professional-account-contact";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase-service";

const REASON_MAX = 1000;

/**
 * The patient cancels a confirmed visit from the emailed link (user, 2026-10-04).
 * Body `{ token, reason? }`.
 * - 200: CANCELLED, cancelled_by patient; the time is free; the professional is emailed.
 * - 403 { code: "window_closed", clinicPhone }: past the professional's notice deadline.
 * - 409: the visit is no longer confirmed (already cancelled, …).
 * - 410 { state: "invalid" | "used" | "expired" }
 */
export async function POST(req: NextRequest) {
  const limited = enforcePublicApiRateLimit(req, "bookingConfirm", {
    body: { message: "Too many attempts. Please try again later." },
  });
  if (limited) return limited;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  let body: { token?: unknown; reason?: unknown };
  try {
    body = (await req.json()) as { token?: unknown; reason?: unknown };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }
  const reason = String(body.reason ?? "").trim().slice(0, REASON_MAX) || null;

  const ctx = await loadPatientCancelContext(service, body.token);
  if (ctx.kind !== "visit") {
    return NextResponse.json({ state: ctx.kind, message: "This link no longer works." }, { status: 410 });
  }
  if (!ctx.linkUsable && !ctx.windowClosed) {
    return NextResponse.json({ state: "expired", message: "This link has expired." }, { status: 410 });
  }
  if (String(ctx.appointment.status).toUpperCase() !== "CONFIRMED") {
    return NextResponse.json({ message: "This appointment is no longer active." }, { status: 409 });
  }
  if (ctx.windowClosed) {
    return NextResponse.json(
      {
        code: "window_closed",
        message: "Online cancellation has closed for this visit. Please call the clinic.",
        clinicPhone: ctx.clinic.phone,
        clinic: ctx.clinic,
      },
      { status: 403 },
    );
  }

  if (!(await consumeAppointmentLink(service, ctx.link.id))) {
    return NextResponse.json({ state: "used", message: "This link no longer works." }, { status: 410 });
  }
  const { data: cancelled, error } = await service
    .from("appointments")
    .update({ status: "CANCELLED", cancelled_by: "patient", cancel_reason: reason })
    .eq("id", ctx.appointment.id)
    .eq("status", "CONFIRMED")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[DocCy] patient cancel", error);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
  if (!cancelled) {
    return NextResponse.json({ message: "This appointment is no longer active." }, { status: 409 });
  }

  // The professional is told (one of the appointment emails she gets; user, 2026-10-04).
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com";
    await sendBuiltEmail(
      professionalAccountEmail(ctx.professional),
      buildProfessionalPatientCancelledEmail({
        professionalName: ctx.professional.name,
        patientName: ctx.appointment.patient_name,
        appointmentIso: ctx.appointment.appointment_datetime,
        clinic: { name: ctx.clinic.name, address: ctx.clinic.address, mapsUrl: ctx.clinic.mapsUrl },
        cancelReason: reason,
        agendaUrl: new URL("/agenda", siteUrl).toString(),
      }),
    );
  } catch (err) {
    console.error("[DocCy] patient cancel: professional email failed", err);
  }

  return NextResponse.json({ message: "Appointment cancelled." }, { status: 200 });
}
