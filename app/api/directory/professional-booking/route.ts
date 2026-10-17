import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { bookingViewerMode, loadBookingAccountKind } from "@/lib/booking-viewer";
import { loadFinderProfilePopupData } from "@/lib/public/finder-profile-popup-data";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase-service";

// Her free times change with every booking: never an answer Next saved earlier.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A registered professional's calendar for the Finder's profile pop-up (mockup F; user,
 * 2026-10-17): what her profile shows to book her, so the patient books without leaving
 * the Finder. An unknown, unregistered or archived professional is a 404. A signed-in
 * professional or applicant is told so (no booking for them, as on the profile).
 */
export async function GET(req: Request) {
  const limited = enforcePublicApiRateLimit(req, "professionalBooking", {
    body: { ok: false, reason: "rate_limited" },
  });
  if (limited) return limited;

  const slug = String(new URL(req.url).searchParams.get("slug") ?? "").trim().toLowerCase();
  if (!slug || slug.length > 200 || !SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, reason: "invalid_slug" }, { status: 400 });
  }

  const viewerMode = async (professionalId: string) => {
    const auth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user?.id) return bookingViewerMode(null, false);
    const service = createServiceRoleClient({ fresh: true });
    if (!service) return bookingViewerMode(null, false);
    const [{ data: owner }, kind] = await Promise.all([
      service.from("professionals").select("auth_user_id").eq("id", professionalId).maybeSingle(),
      loadBookingAccountKind(service, user.id).catch(() => null),
    ]);
    return bookingViewerMode(kind, owner?.auth_user_id === user.id);
  };

  const data = await loadFinderProfilePopupData(slug, viewerMode);
  if (data === "not_found") {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  if (data === "unavailable") {
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
