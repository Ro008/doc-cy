import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { fetchAllSupabaseRows, fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";
import { denyUnlessInternalAuthenticated } from "@/lib/internal-directory-auth";
import {
  getCallToBookWindowDays,
  getManualVotesWindowDays,
  parseCallToBookRange,
  parseDirectoryClicksCsvAction,
  parseManualVotesRange,
} from "@/lib/founder-dashboard-query";
import {
  directoryClicksCsvFilename,
  serializeDirectoryClicksCsv,
  type DirectoryClickCsvEvent,
} from "@/lib/founder-directory-clicks-csv";
import { getPublicBookingBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type ProfessionalMeta = {
  name: string | null;
  slug: string | null;
  specialty: string | null;
  district: string | null;
  isTestProfile: boolean;
  email: string | null;
};

export async function GET(req: NextRequest) {
  const denied = denyUnlessInternalAuthenticated();
  if (denied) return denied;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Server is not configured." }, { status: 503 });
  }

  const url = new URL(req.url);
  const action = parseDirectoryClicksCsvAction(url.searchParams.get("action"));
  const includePhone = action !== "request_online_appointment";
  const includeBooking = action !== "show_phone_number";
  const callToBookRange = parseCallToBookRange(url.searchParams.get("callToBookRange") ?? undefined);
  const manualVotesRange = parseManualVotesRange(
    url.searchParams.get("manualVotesRange") ?? undefined,
  );
  const phoneSince = new Date(
    Date.now() - getCallToBookWindowDays(callToBookRange) * 24 * 60 * 60 * 1000,
  ).toISOString();
  const bookingSince = new Date(
    Date.now() - getManualVotesWindowDays(manualVotesRange) * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [phoneRes, bookingRes] = await Promise.all([
    includePhone
      ? fetchAllSupabaseRows(() =>
          supabase
            .from("professional_call_to_book_clicks")
            .select("professional_id, source, created_at")
            .gte("created_at", phoneSince)
            .order("created_at", { ascending: false }),
        )
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    includeBooking
      ? fetchAllSupabaseRows(() =>
          supabase
            .from("professional_patient_booking_requests")
            .select("professional_id, source, created_at")
            .gte("created_at", bookingSince)
            .order("created_at", { ascending: false }),
        )
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
  ]);

  if (phoneRes.error) {
    console.error("[internal/directory-clicks.csv] phone load failed", phoneRes.error);
    return NextResponse.json({ message: "Could not load show-phone clicks." }, { status: 500 });
  }
  if (bookingRes.error) {
    console.error("[internal/directory-clicks.csv] booking load failed", bookingRes.error);
    return NextResponse.json(
      { message: "Could not load request-online clicks." },
      { status: 500 },
    );
  }

  const phoneRows = phoneRes.data ?? [];
  const bookingRows = bookingRes.data ?? [];
  const ids = [
    ...new Set(
      [...phoneRows, ...bookingRows]
        .map((r) => String((r as { professional_id?: string }).professional_id ?? ""))
        .filter(Boolean),
    ),
  ];

  const { data: professionals, error: proErr } = await fetchAllSupabaseRowsForIdChunks(
    ids,
    (idChunk) =>
      supabase
        .from("professionals")
        .select("id, name, slug, district, specialty, is_test_profile, email")
        .in("id", idChunk),
  );
  if (proErr) {
    console.error("[internal/directory-clicks.csv] professionals load failed", proErr);
    return NextResponse.json({ message: "Could not load professionals." }, { status: 500 });
  }

  const byId = new Map<string, ProfessionalMeta>();
  for (const p of professionals ?? []) {
    byId.set(String((p as { id?: string }).id ?? ""), {
      name: (p as { name?: string | null }).name ?? null,
      slug: (p as { slug?: string | null }).slug ?? null,
      specialty: (p as { specialty?: string | null }).specialty ?? null,
      district: (p as { district?: string | null }).district ?? null,
      isTestProfile: Boolean((p as { is_test_profile?: boolean | null }).is_test_profile),
      email: (p as { email?: string | null }).email ?? null,
    });
  }

  const events: DirectoryClickCsvEvent[] = [];
  for (const r of phoneRows) {
    const id = String((r as { professional_id?: string }).professional_id ?? "");
    const meta = byId.get(id);
    events.push({
      clickedAtIso: String((r as { created_at?: string }).created_at ?? ""),
      action: "show_phone_number",
      name: meta?.name ?? null,
      slug: meta?.slug ?? null,
      specialty: meta?.specialty ?? null,
      district: meta?.district ?? null,
      source: String((r as { source?: string | null }).source ?? ""),
      isTestProfile: meta?.isTestProfile ?? false,
      email: meta?.email ?? null,
    });
  }
  for (const r of bookingRows) {
    const id = String((r as { professional_id?: string }).professional_id ?? "");
    const meta = byId.get(id);
    events.push({
      clickedAtIso: String((r as { created_at?: string }).created_at ?? ""),
      action: "request_online_appointment",
      name: meta?.name ?? null,
      slug: meta?.slug ?? null,
      specialty: meta?.specialty ?? null,
      district: meta?.district ?? null,
      source: String((r as { source?: string | null }).source ?? ""),
      isTestProfile: meta?.isTestProfile ?? false,
      email: meta?.email ?? null,
    });
  }

  events.sort((a, b) => String(b.clickedAtIso).localeCompare(String(a.clickedAtIso)));

  const csv = serializeDirectoryClicksCsv(events, getPublicBookingBaseUrl());
  const filename = directoryClicksCsvFilename({
    action,
    callToBookRange,
    manualVotesRange,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
