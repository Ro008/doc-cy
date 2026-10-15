import { NextResponse } from "next/server";
import { parseCallToBookSource, type CallToBookSource } from "@/lib/call-to-book";
import { formatCyprusPhoneDisplay } from "@/lib/phone-link";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { USER_EVENTS_TABLE, showClinicPhoneNumberEvent, userEventSourceFor } from "@/lib/user-events";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  kind?: string;
  id?: string;
  source?: string;
  manualId?: string;
};

function normalizePhone(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return formatCyprusPhoneDisplay(raw) || raw;
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

/**
 * Whether the professional works at this clinic, and whether she is registered right now
 * (stored with the click: a listing that signs up later keeps its earlier clicks as
 * unregistered). Null when she is not linked to the clinic or a lookup failed.
 */
async function professionalAtClinic(
  supabase: SupabaseClient,
  manualId: string,
  clinicId: string,
): Promise<{ isRegistered: boolean } | null> {
  const { data: link, error: linkErr } = await supabase
    .from("professional_clinics")
    .select("clinic_id")
    .eq("professional_id", manualId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (linkErr) {
    console.error("[DocCy][contact-reveal] clinic_link_lookup_failed", linkErr.message);
    return null;
  }
  if (!link) return null;
  const { data: professional, error: proErr } = await supabase
    .from("professionals")
    .select("is_registered")
    .eq("id", manualId)
    .maybeSingle();
  if (proErr || !professional) {
    if (proErr) console.error("[DocCy][contact-reveal] professional_lookup_failed", proErr.message);
    return null;
  }
  return { isRegistered: Boolean((professional as { is_registered?: boolean | null }).is_registered) };
}

/** Records the reveal in user_events: what (a clinic's phone) and where (user, 2026-10-15). */
async function logClinicPhoneReveal(input: {
  supabase: SupabaseClient;
  place: CallToBookSource;
  clinicId: string;
  manualId: string;
}): Promise<void> {
  let event;
  if (input.place === "clinic_page") {
    // A clinic's own page: the clinic, no professional.
    event = showClinicPhoneNumberEvent({ professionalId: null, clinicId: input.clinicId, source: "clinic_page" });
  } else {
    if (!input.manualId) return;
    const professional = await professionalAtClinic(input.supabase, input.manualId, input.clinicId);
    if (!professional) return;
    event = showClinicPhoneNumberEvent({
      professionalId: input.manualId,
      clinicId: input.clinicId,
      source: userEventSourceFor(input.place, professional.isRegistered),
    });
  }
  const { error } = await input.supabase.from(USER_EVENTS_TABLE).insert(event);
  if (error) {
    console.error("[DocCy][contact-reveal] reveal_log_failed", error.message);
  }
}

/**
 * Reveal a clinic's phone after an intentional click. Every public phone is the clinic's
 * (user, 2026-09-29): listings and registered professionals alike, and the scraped
 * `professionals.phone` is never shown. Keeps phone out of SSR HTML / RSC props
 * (anti-scraping P1). Every phone button passes `source` (where it is) and, except on a
 * clinic's own page, the professional (`manualId`), so each reveal is stored in user_events.
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

  if (kind === "clinic") {
    const looked = await clinicPhone(supabase, id);
    if (looked.error) {
      return NextResponse.json({ ok: false, reason: "lookup_failed" }, { status: 500 });
    }
    if (!looked.found) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }

    const phone = looked.phone;
    const linkedManualId = UUID_RE.test(manualIdFromBody) ? manualIdFromBody : "";

    if (source && phone) {
      await logClinicPhoneReveal({ supabase, place: source, clinicId: id, manualId: linkedManualId });
    }

    return NextResponse.json({ ok: true, phone });
  }

  return NextResponse.json({ ok: false, reason: "invalid_kind" }, { status: 400 });
}
