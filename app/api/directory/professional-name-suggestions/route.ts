import { NextResponse } from "next/server";
import { isRegisteredDoctorHiddenFromFinder } from "@/lib/doctor-test-profile";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { escapeIlikePattern } from "@/lib/finder-results-paging";
import {
  normalizeFinderNameQuery,
  shapeFinderNameSuggestions,
  type FinderNameSuggestionRow,
} from "@/lib/finder-who-search";
import { LISTING_CLINICS_SELECT, listingClinicLocations } from "@/lib/listing-clinic-location";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { SPECIALTY_LINKS_SELECT, specialtyNamesForRow } from "@/lib/specialty-catalogue";
import { createServiceRoleClient } from "@/lib/supabase-service";

/** Enough rows to put registered professionals first among the five shown. */
const CANDIDATE_ROWS = 25;

function publicAvatarUrl(rawValue: unknown): string | null {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/avatars/${raw.replace(/^\/+/, "")}`;
}

/**
 * Professionals whose name holds what the patient types in the Finder's "Specialty or
 * name" field (mockup R3; user, 2026-10-16): five at most, each with the page the Finder
 * links to. Only what the Finder shows anyway: name, first specialty, first clinic's
 * district, and a registered professional's own photo.
 */
export async function GET(req: Request) {
  const limited = enforcePublicApiRateLimit(req, "professionalNameSuggest", {
    body: { ok: false, reason: "rate_limited" },
  });
  if (limited) return limited;

  const query = normalizeFinderNameQuery(new URL(req.url).searchParams.get("q"));
  if (!query) return NextResponse.json({ ok: true, suggestions: [] });

  // Fresh reads: a cookie-less GET route would otherwise get an answer Next saved earlier.
  const supabase = createServiceRoleClient({ fresh: true });
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "service_role_not_configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("professionals")
    .select(
      `id, name, slug, email, avatar_url, is_registered, is_test_profile, ${SPECIALTY_LINKS_SELECT}, ${LISTING_CLINICS_SELECT}`,
    )
    .eq("is_archived", false)
    .not("slug", "is", null)
    .ilike("name", `%${escapeIlikePattern(query)}%`)
    .order("is_registered", { ascending: false })
    .order("name", { ascending: true })
    .limit(CANDIDATE_ROWS);
  if (error) {
    console.error("[DocCy][professional-name-suggestions] read_failed", error.message);
    return NextResponse.json({ ok: false, reason: "read_failed" }, { status: 500 });
  }

  const rows: FinderNameSuggestionRow[] = [];
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const isRegistered = Boolean(raw.is_registered);
    if (
      isRegistered &&
      isRegisteredDoctorHiddenFromFinder({
        name: raw.name as string | null,
        slug: raw.slug as string | null,
        email: raw.email as string | null,
        isTestProfile: Boolean(raw.is_test_profile),
      })
    ) {
      continue;
    }
    rows.push({
      id: String(raw.id ?? ""),
      name: doctorDashboardDisplayName(String(raw.name ?? "")),
      slug: (raw.slug as string | null) ?? null,
      isRegistered,
      ownPhotoUrl: isRegistered ? publicAvatarUrl(raw.avatar_url) : null,
      specialty: specialtyNamesForRow(raw)[0] ?? null,
      district: listingClinicLocations(raw)[0]?.district ?? null,
    });
  }

  return NextResponse.json({ ok: true, suggestions: shapeFinderNameSuggestions(rows) });
}
