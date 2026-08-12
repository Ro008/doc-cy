import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  kind?: string;
  id?: string;
};

/**
 * Reveal phone for a manual listing or clinic after an intentional click.
 * Keeps phone out of SSR HTML / RSC props (anti-scraping P1).
 */
export async function POST(req: Request) {
  const limited = enforcePublicApiRateLimit(req, "contactReveal", {
    body: { ok: false, reason: "rate_limited" },
  });
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

  const kind = String(body.kind ?? "").trim();
  const id = String(body.id ?? "").trim();
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, reason: "invalid_id" }, { status: 400 });
  }

  if (kind === "manual") {
    const { data, error } = await supabase
      .from("directory_manual")
      .select("phone")
      .eq("id", id)
      .eq("is_archived", false)
      .maybeSingle();
    if (error) {
      console.error("[DocCy][contact-reveal] manual_lookup_failed", error.message);
      return NextResponse.json({ ok: false, reason: "lookup_failed" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    const phone = String((data as { phone?: string | null }).phone ?? "").trim() || null;
    return NextResponse.json({ ok: true, phone });
  }

  if (kind === "clinic") {
    const { data, error } = await supabase
      .from("clinics")
      .select("phone")
      .eq("id", id)
      .eq("is_archived", false)
      .maybeSingle();
    if (error) {
      console.error("[DocCy][contact-reveal] clinic_lookup_failed", error.message);
      return NextResponse.json({ ok: false, reason: "lookup_failed" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    const phone = String((data as { phone?: string | null }).phone ?? "").trim() || null;
    return NextResponse.json({ ok: true, phone });
  }

  return NextResponse.json({ ok: false, reason: "invalid_kind" }, { status: 400 });
}
