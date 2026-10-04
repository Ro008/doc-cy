import { NextRequest, NextResponse } from "next/server";

import { consumeAppointmentLink } from "@/lib/appointment-links-db";
import { loadPatientReviewContext } from "@/lib/patient-review";
import { parseReviewSubmission } from "@/lib/professional-review";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * The patient leaves a verified review from the emailed link (user, 2026-10-04).
 * Body `{ token, rating, comment, email }`.
 * - 200: stored in professional_reviews (published); the link is used up.
 * - 400 { code: "rating" | "comment" | "email_mismatch" }: nothing used, they can fix it.
 * - 409: no review for this visit (no-show, didn't happen, already reviewed).
 * - 410 { state: "invalid" | "used" | "expired" }
 */
export async function POST(req: NextRequest) {
  const limited = enforcePublicApiRateLimit(req, "bookingConfirm", {
    body: { message: "Too many attempts. Please try again later." },
  });
  if (limited) return limited;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  let body: { token?: unknown; rating?: unknown; comment?: unknown; email?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const ctx = await loadPatientReviewContext(service, body.token);
  if (ctx.kind !== "visit") {
    return NextResponse.json({ state: ctx.kind, message: "This link no longer works." }, { status: 410 });
  }
  if (ctx.eligibility !== "ok") {
    return NextResponse.json(
      { code: ctx.eligibility, message: "A review can't be left for this visit." },
      { status: 409 },
    );
  }

  const parsed = parseReviewSubmission(body, ctx.appointment.patient_email);
  if (!parsed.ok) {
    return NextResponse.json({ code: parsed.code, message: parsed.message }, { status: 400 });
  }

  if (!(await consumeAppointmentLink(service, ctx.link.id))) {
    return NextResponse.json({ state: "used", message: "This link no longer works." }, { status: 410 });
  }
  const { error } = await service.from("professional_reviews").insert({
    professional_id: ctx.appointment.professional_id,
    appointment_id: ctx.appointment.id,
    rating: parsed.rating,
    comment: parsed.comment,
    reviewer_name: ctx.appointment.patient_name,
    reviewer_email: String(ctx.appointment.patient_email ?? "").trim(),
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ code: "already_reviewed", message: "This visit already has a review." }, { status: 409 });
    }
    console.error("[DocCy] review insert", error);
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
