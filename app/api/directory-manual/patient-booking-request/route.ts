import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Same window as internal /directory stats (approx. unique voters). */
const DEDUPE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip")?.trim();
  if (xri) return xri;
  return "";
}

function voterFingerprint(ip: string, manualId: string): string | null {
  const secret = process.env.DOC_CY_VOTE_FINGERPRINT_SECRET?.trim();
  if (!secret || !ip) return null;
  return createHmac("sha256", secret).update(`${ip}|${manualId}`).digest("hex");
}

type Body = {
  manualId?: string;
};

export async function POST(req: Request) {
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

  const { data: row, error: lookupErr } = await supabase
    .from("directory_manual")
    .select("id")
    .eq("id", manualId)
    .eq("is_archived", false)
    .maybeSingle();

  if (lookupErr) {
    console.error("[DocCy][manual-booking-request] lookup_failed", lookupErr.message);
    return NextResponse.json({ ok: false, reason: "lookup_failed" }, { status: 500 });
  }
  if (!row?.id) {
    return NextResponse.json({ ok: false, reason: "manual_not_found" }, { status: 404 });
  }

  const ip = getClientIp(req);
  const voterKey = voterFingerprint(ip, manualId);
  const sinceIso = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();

  if (voterKey) {
    const { data: existing, error: dupErr } = await supabase
      .from("directory_manual_patient_booking_requests")
      .select("id")
      .eq("manual_id", manualId)
      .eq("voter_key", voterKey)
      .gte("created_at", sinceIso)
      .maybeSingle();

    if (dupErr) {
      console.error("[DocCy][manual-booking-request] dedupe_lookup_failed", dupErr.message);
      return NextResponse.json({ ok: false, reason: "dedupe_lookup_failed" }, { status: 500 });
    }
    if (existing?.id) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }
  }

  const { error: insertErr } = await supabase
    .from("directory_manual_patient_booking_requests")
    .insert({
      manual_id: manualId,
      source: "finder_card",
      ...(voterKey ? { voter_key: voterKey } : {}),
    });

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

  return NextResponse.json({ ok: true }, { status: 201 });
}
