import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { getClientIp, voterFingerprint } from "@/lib/vote-fingerprint";
import { parseBookingRequestSource } from "@/lib/finder-manual-patient-booking-request";
import {
  USER_EVENTS_TABLE,
  isUniqueViolation,
  onlineAppointmentRequestEvent,
} from "@/lib/user-events";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  manualId?: string;
  clinicId?: string | null;
  source?: string | null;
};

export async function POST(req: Request) {
  const limited = enforcePublicApiRateLimit(req, "manualBookingRequest");
  if (limited) return limited;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "service_role_not_configured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const manualId = String(body.manualId ?? "").trim();
  if (!UUID_RE.test(manualId)) {
    return NextResponse.json({ ok: false, reason: "invalid_manual_id" }, { status: 400 });
  }

  const clinicIdRaw = String(body.clinicId ?? "").trim();
  const clinicId = UUID_RE.test(clinicIdRaw) ? clinicIdRaw : null;
  const source = parseBookingRequestSource(body.source);

  const { data: row, error: lookupErr } = await supabase
    .from("professionals")
    .select("id")
    .eq("id", manualId)
    .eq("is_archived", false)
    .eq("is_registered", false)
    .maybeSingle();

  if (lookupErr) {
    console.error("[DocCy][manual-booking-request] lookup_failed", lookupErr.message);
    return NextResponse.json({ ok: false, reason: "lookup_failed" }, { status: 500 });
  }
  if (!row?.id) {
    return NextResponse.json({ ok: false, reason: "manual_not_found" }, { status: 404 });
  }

  const ip = getClientIp(req.headers);
  const voterKey = voterFingerprint(manualId, ip);

  // One vote per IP+professional fingerprint, kept by a unique index: a repeat vote
  // still gets the thank-you toast (Ads skips it).
  const { error: insertErr } = await supabase.from(USER_EVENTS_TABLE).insert(
    onlineAppointmentRequestEvent({ professionalId: manualId, clinicId, source, visitorKey: voterKey }),
  );
  if (isUniqueViolation(insertErr)) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  if (insertErr) {
    const code = String((insertErr as { code?: string }).code ?? "");
    const msg = String(insertErr.message ?? "");
    console.error("[DocCy][manual-booking-request] insert_failed", code, msg);
    const reason =
      code === "42501" || /permission denied/i.test(msg) ? "permission_denied" : "insert_failed";
    return NextResponse.json({ ok: false, reason }, { status: 500 });
  }

  return NextResponse.json({ ok: true, duplicate: false }, { status: 201 });
}
