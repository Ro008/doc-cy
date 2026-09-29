import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { enforcePublicApiRateLimit } from "@/lib/public-api-rate-limit";
import { escapeIlikePattern } from "@/lib/finder-results-paging";
import {
  clinicSearchTokens,
  rankClinicSearchResults,
  type ClinicSearchCandidate,
} from "@/lib/register-clinic-search";

export const dynamic = "force-dynamic";

/** Enough rows for ranking after the one-word prefilter below. */
const CANDIDATE_LIMIT = 200;
const MAX_QUERY_LENGTH = 80;

const noStore = { "Cache-Control": "no-store" };

/**
 * Read-only type-ahead for the register clinic field. Returns public clinic
 * fields only (what /clinics already shows), never phones or GeSY codes.
 */
export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
  const tokens = clinicSearchTokens(query);
  if (tokens.length === 0) {
    return NextResponse.json({ results: [] }, { headers: noStore });
  }

  const limited = enforcePublicApiRateLimit(req, "clinicSearch", {
    body: { results: [], reason: "rate_limited" },
  });
  if (limited) return limited;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ results: [] }, { status: 503, headers: noStore });
  }

  // Prefilter on the longest word (most selective); ranking applies every word.
  const key = [...tokens].sort((a, b) => b.length - a.length)[0]!;
  const pattern = `%${escapeIlikePattern(key)}%`;
  const { data, error } = await supabase
    .from("clinics")
    .select("id, name, address, town, district, latitude, longitude, clinic_place_id")
    .eq("is_archived", false)
    .or(`name.ilike.${pattern},address.ilike.${pattern},town.ilike.${pattern}`)
    .limit(CANDIDATE_LIMIT);
  if (error) {
    console.error("[DocCy] register clinic search failed", error);
    return NextResponse.json({ results: [] }, { status: 500, headers: noStore });
  }

  const rows = (data ?? []) as {
    id: string;
    name: string | null;
    address: string | null;
    town: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
    clinic_place_id: string | null;
  }[];

  const counts = new Map<string, number>();
  if (rows.length > 0) {
    const { data: links } = await supabase
      .from("professional_clinics")
      .select("clinic_id")
      .in(
        "clinic_id",
        rows.map((row) => row.id),
      );
    for (const link of (links ?? []) as { clinic_id: string }[]) {
      counts.set(link.clinic_id, (counts.get(link.clinic_id) ?? 0) + 1);
    }
  }

  const candidates: ClinicSearchCandidate[] = rows
    .filter((row) => String(row.name ?? "").trim() && String(row.address ?? "").trim())
    .map((row) => ({
      id: row.id,
      name: String(row.name).trim(),
      address: String(row.address).trim(),
      town: row.town,
      district: String(row.district ?? ""),
      latitude: row.latitude,
      longitude: row.longitude,
      placeId: row.clinic_place_id,
      professionalCount: counts.get(row.id) ?? 0,
    }));

  return NextResponse.json(
    { results: rankClinicSearchResults(candidates, query) },
    { headers: noStore },
  );
}
