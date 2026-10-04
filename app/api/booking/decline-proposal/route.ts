import { NextRequest, NextResponse } from "next/server";

import { consumeAppointmentLink } from "@/lib/appointment-links-db";
import { buildProfessionalPatientDeclinedProposalEmail, sendBuiltEmail } from "@/lib/booking-request-emails";
import { loadPatientProposalContext } from "@/lib/patient-proposal";
import { professionalAccountEmail } from "@/lib/professional-account-contact";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase-service";

const MESSAGE_MAX = 1000;

/**
 * The patient declines the proposed times (user, 2026-10-04): no ping-pong, the request
 * closes as CANCELLED, cancelled_by patient (optional message in cancel_reason); the
 * held times are freed; the professional is emailed. Body `{ token, message? }`.
 */
export async function POST(req: NextRequest) {
  const limited = enforcePublicApiRateLimit(req, "bookingConfirm", {
    body: { message: "Too many attempts. Please try again later." },
  });
  if (limited) return limited;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  let body: { token?: unknown; message?: unknown };
  try {
    body = (await req.json()) as { token?: unknown; message?: unknown };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }
  const message = String(body.message ?? "").trim().slice(0, MESSAGE_MAX) || null;

  const ctx = await loadPatientProposalContext(service, body.token);
  if (ctx.kind !== "proposal") {
    return NextResponse.json({ state: ctx.kind, message: "This link no longer works." }, { status: 410 });
  }
  if (!(await consumeAppointmentLink(service, ctx.link.id))) {
    return NextResponse.json({ state: "used", message: "This link no longer works." }, { status: 410 });
  }
  const { data: saved, error } = await service
    .from("appointments")
    .update({
      status: "CANCELLED",
      cancelled_by: "patient",
      cancel_reason: message,
      proposed_slots: null,
      proposal_expires_at: null,
    })
    .eq("id", ctx.appointment.id)
    .eq("status", "NEEDS_RESCHEDULE")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[DocCy] decline proposal", error);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
  if (!saved) return NextResponse.json({ state: "used", message: "This proposal is no longer open." }, { status: 410 });

  try {
    await sendBuiltEmail(
      professionalAccountEmail(ctx.professional),
      buildProfessionalPatientDeclinedProposalEmail({
        professionalName: ctx.professional.name,
        patientName: ctx.appointment.patient_name,
        message,
      }),
    );
  } catch (err) {
    console.error("[DocCy] decline proposal: professional email", err);
  }

  return NextResponse.json({ message: "Declined." }, { status: 200 });
}
