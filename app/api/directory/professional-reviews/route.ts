import { NextResponse } from "next/server";
import { loadPublishedReviews } from "@/lib/public/load-profile-reviews";
import { summariseReviews } from "@/lib/public/profile-reviews";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase-service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A registered professional's published reviews, for the pop-up her finder card opens
 * (mockup L; user, 2026-10-16). The same reviews her profile shows, in the same shape
 * (no reviewer emails). An unknown, unregistered or archived professional is a 404.
 */
export async function GET(req: Request) {
  const limited = enforcePublicApiRateLimit(req, "profileReviews", {
    body: { ok: false, reason: "rate_limited" },
  });
  if (limited) return limited;

  const id = String(new URL(req.url).searchParams.get("professionalId") ?? "").trim();
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, reason: "invalid_id" }, { status: 400 });
  }

  // Fresh reads: a cookie-less GET route would otherwise get an answer Next saved earlier.
  const supabase = createServiceRoleClient({ fresh: true });
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "service_role_not_configured" }, { status: 503 });
  }

  const { data: professional, error } = await supabase
    .from("professionals")
    .select("id, is_registered, is_archived")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[DocCy][professional-reviews] professional_read_failed", error.message);
    return NextResponse.json({ ok: false, reason: "read_failed" }, { status: 500 });
  }
  if (!professional || !professional.is_registered || professional.is_archived) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const reviews = await loadPublishedReviews(supabase, id);
  const { count, average } = summariseReviews(reviews);
  return NextResponse.json({ ok: true, count, average, reviews });
}
