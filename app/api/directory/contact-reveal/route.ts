import { NextResponse } from "next/server";
import { parseCallToBookSource } from "@/lib/call-to-book";
import { formatCyprusPhoneDisplay } from "@/lib/phone-link";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  kind?: string;
  id?: string;
  source?: string;
  manualId?: string;
  clinicId?: string;
};

function normalizePhone(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return formatCyprusPhoneDisplay(raw) || raw;
}

async function listingPhone(
  supabase: SupabaseClient,
  manualId: string,
): Promise<{ phone: string | null; found: boolean; error: boolean }> {
  const { data, error } = await supabase
    .from("professionals")
    .select("phone")
    .eq("id", manualId)
    .eq("is_archived", false)
    .maybeSingle();
  if (error) {
    console.error("[DocCy][contact-reveal] manual_lookup_failed", error.message);
    return { phone: null, found: false, error: true };
  }
  if (!data) return { phone: null, found: false, error: false };
  return {
    phone: normalizePhone((data as { phone?: string | null }).phone),
    found: true,
    error: false,
  };
}

async function clinicPhone(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<{ phone: string | null; found: boolean; error: boolean }> {
  const { data, error } = await supabase
    .from("clinics")
    .select("phone")
    .eq("id", clinicId)
    .eq("is_archived", false)
    .maybeSingle();
  if (error) {
    console.error("[DocCy][contact-reveal] clinic_lookup_failed", error.message);
    return { phone: null, found: false, error: true };
  }
  if (!data) return { phone: null, found: false, error: false };
  return {
    phone: normalizePhone((data as { phone?: string | null }).phone),
    found: true,
    error: false,
  };
}

async function professionalLinkedToClinic(
  supabase: SupabaseClient,
  manualId: string,
  clinicId: string,
): Promise<boolean> {
  const { data: link, error: linkErr } = await supabase
    .from("directory_manual_clinics")
    .select("clinic_id")
    .eq("directory_manual_id", manualId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (linkErr) {
    console.error("[DocCy][contact-reveal] clinic_link_lookup_failed", linkErr.message);
    return false;
  }
  if (link) return true;

  const { data: row, error: rowErr } = await supabase
    .from("professionals")
    .select("clinic_id")
    .eq("id", manualId)
    .eq("is_archived", false)
    .maybeSingle();
  if (rowErr) {
    console.error("[DocCy][contact-reveal] listing_clinic_lookup_failed", rowErr.message);
    return false;
  }
  return String((row as { clinic_id?: string | null } | null)?.clinic_id ?? "").trim() === clinicId;
}

async function logCallToBookClick(input: {
  supabase: SupabaseClient;
  manualId: string;
  clinicId: string | null;
  source: "finder_card" | "professional_profile_page";
}): Promise<void> {
  const { error } = await input.supabase.from("directory_manual_call_to_book_clicks").insert({
    manual_id: input.manualId,
    clinic_id: input.clinicId,
    source: input.source,
  });
  if (error) {
    console.error("[DocCy][contact-reveal] call_to_book_log_failed", error.message);
  }
}

/**
 * Reveal phone for a manual listing or clinic after an intentional click.
 * Keeps phone out of SSR HTML / RSC props (anti-scraping P1).
 * Call to Book CTAs pass `source` so the click is stored for the founder dashboard.
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
  const source = parseCallToBookSource(body.source);
  const manualIdFromBody = String(body.manualId ?? "").trim();
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, reason: "invalid_id" }, { status: 400 });
  }

  if (kind === "manual") {
    const looked = await listingPhone(supabase, id);
    if (looked.error) {
      return NextResponse.json({ ok: false, reason: "lookup_failed" }, { status: 500 });
    }
    if (!looked.found) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    if (source && looked.phone) {
      const attributedClinic = String(body.clinicId ?? "").trim();
      let clinicId: string | null = UUID_RE.test(attributedClinic) ? attributedClinic : null;
      if (clinicId && !(await professionalLinkedToClinic(supabase, id, clinicId))) {
        clinicId = null;
      }
      await logCallToBookClick({
        supabase,
        manualId: id,
        clinicId,
        source,
      });
    }
    return NextResponse.json({ ok: true, phone: looked.phone });
  }

  if (kind === "clinic") {
    const looked = await clinicPhone(supabase, id);
    if (looked.error) {
      return NextResponse.json({ ok: false, reason: "lookup_failed" }, { status: 500 });
    }
    if (!looked.found) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }

    let phone = looked.phone;
    const linkedManualId = UUID_RE.test(manualIdFromBody) ? manualIdFromBody : "";
    let linked = false;
    if (linkedManualId) {
      linked = await professionalLinkedToClinic(supabase, linkedManualId, id);
      if (!phone && linked) {
        const listing = await listingPhone(supabase, linkedManualId);
        if (listing.error) {
          return NextResponse.json({ ok: false, reason: "lookup_failed" }, { status: 500 });
        }
        phone = listing.phone;
      }
    }

    if (source && phone && linkedManualId && linked) {
      await logCallToBookClick({
        supabase,
        manualId: linkedManualId,
        clinicId: id,
        source,
      });
    }

    return NextResponse.json({ ok: true, phone });
  }

  return NextResponse.json({ ok: false, reason: "invalid_kind" }, { status: 400 });
}
