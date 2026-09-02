import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { getClientIp, voterFingerprint } from "@/lib/vote-fingerprint";
import { parseBookingRequestSource } from "@/lib/finder-manual-patient-booking-request";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** UI still treats a repeat voter as one patient; every tap still inserts a row. */
const DUPLICATE_UI_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

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

  const ip = getClientIp(req);
  const voterKey = voterFingerprint(manualId, ip);
  const sinceIso = new Date(Date.now() - DUPLICATE_UI_WINDOW_MS).toISOString();
  let duplicate = false;

  if (voterKey) {
    const { data: existing, error: dupErr } = await supabase
      .from("professional_patient_booking_requests")
      .select("id")
      .eq("professional_id", manualId)
      .eq("voter_key", voterKey)
      .gte("created_at", sinceIso)
      .limit(1);

    if (dupErr) {
      console.error("[DocCy][manual-booking-request] dedupe_lookup_failed", dupErr.message);
      return NextResponse.json({ ok: false, reason: "dedupe_lookup_failed" }, { status: 500 });
    }
    duplicate = Boolean((existing ?? [])[0]?.id);
  }

  const insertPayload: Record<string, unknown> = {
    professional_id: manualId,
    source,
    ...(voterKey ? { voter_key: voterKey } : {}),
    ...(clinicId ? { clinic_id: clinicId } : {}),
  };

  let { error: insertErr } = await supabase
    .from("professional_patient_booking_requests")
    .insert(insertPayload);

  if (insertErr && clinicId) {
    const code = String((insertErr as { code?: string }).code ?? "");
    const msg = String(insertErr.message ?? "");
    if (code === "42703" || /clinic_id/i.test(msg)) {
      delete insertPayload.clinic_id;
      const retry = await supabase
        .from("professional_patient_booking_requests")
        .insert(insertPayload);
      insertErr = retry.error;
    }
  }

  if (insertErr) {
    const code = String((insertErr as { code?: string }).code ?? "");
    const msg = String(insertErr.message ?? "");
    console.error("[DocCy][manual-booking-request] insert_failed", code, msg);
    const reason =
      code === "42P01" || /relation.*does not exist|could not find the table/i.test(msg)
        ? "table_missing"
        : code === "42501" || /permission denied/i.test(msg)
          ? "permission_denied"
          : "insert_failed";
    return NextResponse.json({ ok: false, reason }, { status: 500 });
  }

  return NextResponse.json({ ok: true, duplicate }, { status: duplicate ? 200 : 201 });
}
