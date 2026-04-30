import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

type TrafficPayload = {
  session_id?: string;
  page_path?: string;
  traffic_origin?: "direct" | "ref";
  ref_code?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  city?: string | null;
  country?: string | null;
  user_agent?: string | null;
  is_bot?: boolean;
  created_at?: string;
};

function sanitizeText(value: unknown, max = 200): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(req: Request) {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "service_role_not_configured" }, { status: 503 });
  }

  let payload: TrafficPayload;
  try {
    payload = (await req.json()) as TrafficPayload;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const sessionId = sanitizeText(payload.session_id, 120);
  const pagePath = sanitizeText(payload.page_path, 300);
  const origin = payload.traffic_origin === "ref" ? "ref" : "direct";
  const createdAt = sanitizeText(payload.created_at, 64);
  if (!sessionId || !pagePath || !createdAt) {
    return NextResponse.json({ ok: false, reason: "missing_required_fields" }, { status: 400 });
  }

  const row = {
    session_id: sessionId,
    page_path: pagePath,
    traffic_origin: origin,
    ref_code: sanitizeText(payload.ref_code, 80),
    utm_source: sanitizeText(payload.utm_source, 80),
    utm_medium: sanitizeText(payload.utm_medium, 80),
    city: sanitizeText(payload.city, 120),
    country: sanitizeText(payload.country, 120),
    user_agent: sanitizeText(payload.user_agent, 512),
    is_bot: Boolean(payload.is_bot),
    created_at: createdAt,
  };

  const { error } = await supabase.from("website_visits").insert(row);
  if (error) {
    console.error("[DocCy][traffic] insert_failed", error.message);
    return NextResponse.json({ ok: false, reason: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
