import { NextResponse } from "next/server";
import { loadPublicPersonalMobile } from "@/lib/public/load-profile-personal-mobile";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { USER_EVENTS_TABLE, showPersonalMobileNumberEvent } from "@/lib/user-events";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Reveal a professional's personal mobile after an intentional click on her public
 * profile ("Show mobile", user 2026-10-13). Only when she switched "Show on my profile"
 * on; otherwise the answer is the same 404 as for an unknown id, so the route never says
 * whether a hidden number exists. Keeps the mobile out of SSR HTML / RSC props, like the
 * clinic phones (`/api/directory/contact-reveal`), and shares their rate limit.
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

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (!body) {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, reason: "invalid_id" }, { status: 400 });
  }

  const mobile = await loadPublicPersonalMobile(supabase, id);
  if (!mobile) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  // Recorded like the clinic phones (user, 2026-10-15); a failed record never hides the number.
  const { error } = await supabase.from(USER_EVENTS_TABLE).insert(showPersonalMobileNumberEvent({ professionalId: id }));
  if (error) {
    console.error("[DocCy][professional-mobile-reveal] reveal_log_failed", error.message);
  }
  return NextResponse.json({ ok: true, phone: mobile });
}
