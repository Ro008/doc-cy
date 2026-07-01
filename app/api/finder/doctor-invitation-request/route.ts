import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isSupabaseMissingTableError } from "@/lib/supabase-db-errors";
import { getClientIp, voterFingerprint } from "@/lib/vote-fingerprint";

const DEDUPE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const MIN_NAME_LEN = 2;
const MAX_NAME_LEN = 120;
const MIN_SPECIALTY_LEN = 2;
const MAX_SPECIALTY_LEN = 80;
const MAX_CONTEXT_LEN = 80;

function normalizeRequestedName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSpecialty(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_SPECIALTY_LEN);
}

function normalizeContext(value: string | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_CONTEXT_LEN);
}

function invitationDedupeScope(
  requestedName: string,
  specialty: string,
  district: string | null,
): string {
  return `invitation|${requestedName.toLowerCase()}|${specialty.toLowerCase()}|${district ?? ""}`;
}

type Body = {
  requestedName?: string;
  specialty?: string;
  district?: string;
  searchName?: string;
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

  const requestedName = normalizeRequestedName(String(body.requestedName ?? ""));
  if (requestedName.length < MIN_NAME_LEN || requestedName.length > MAX_NAME_LEN) {
    return NextResponse.json({ ok: false, reason: "invalid_requested_name" }, { status: 400 });
  }

  const specialty = normalizeSpecialty(String(body.specialty ?? ""));
  if (specialty.length < MIN_SPECIALTY_LEN) {
    return NextResponse.json({ ok: false, reason: "invalid_specialty" }, { status: 400 });
  }
  const district = normalizeContext(body.district);
  const searchName = normalizeContext(body.searchName);

  const ip = getClientIp(req);
  const voterKey = voterFingerprint(invitationDedupeScope(requestedName, specialty, district), ip);
  const sinceIso = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();

  if (voterKey) {
    const { data: existing, error: dupErr } = await supabase
      .from("finder_doctor_invitation_requests")
      .select("id")
      .eq("voter_key", voterKey)
      .eq("requested_name", requestedName)
      .gte("created_at", sinceIso)
      .maybeSingle();

    if (dupErr) {
      console.error("[DocCy][finder-invitation] dedupe_lookup_failed", dupErr.message);
      if (isSupabaseMissingTableError(dupErr)) {
        return NextResponse.json({ ok: false, reason: "table_missing" }, { status: 500 });
      }
      return NextResponse.json({ ok: false, reason: "dedupe_lookup_failed" }, { status: 500 });
    }
    if (existing?.id) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }
  }

  const { error: insertErr } = await supabase.from("finder_doctor_invitation_requests").insert({
    requested_name: requestedName,
    specialty,
    district,
    search_name: searchName,
    source: "finder_empty_state",
    ...(voterKey ? { voter_key: voterKey } : {}),
  });

  if (insertErr) {
    const code = String((insertErr as { code?: string }).code ?? "");
    const msg = String(insertErr.message ?? "");
    console.error("[DocCy][finder-invitation] insert_failed", code, msg);
    const reason = isSupabaseMissingTableError(insertErr)
      ? "table_missing"
      : code === "42501" || /permission denied/i.test(msg)
        ? "permission_denied"
        : "insert_failed";
    return NextResponse.json({ ok: false, reason }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
