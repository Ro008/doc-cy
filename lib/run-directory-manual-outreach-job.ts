import type { SupabaseClient } from "@supabase/supabase-js";
import { isDirectoryCanaryId, isDirectoryCanarySlug } from "@/lib/directory-canaries";
import {
  OUTREACH_COOLDOWN_MS,
  OUTREACH_MAX_SENDS_PER_RUN,
  OUTREACH_WINDOW_MS,
  countByManualId,
  getDirectoryOutreachReplyTo,
  isDirectoryManualOutreachEnabled,
  mergeOutreachCounts,
  shouldSendDirectoryOutreach,
  sortOutreachCandidates,
  type OutreachCountRow,
} from "@/lib/directory-manual-outreach";
import { normalizeOutreachEmail } from "@/lib/directory-manual-outreach-token";
import { isTestDoctorRegistrationEmail } from "@/lib/doctor-test-profile";
import { sendDirectoryManualOutreachEmail } from "@/lib/send-directory-manual-outreach-email";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import {
  fetchAllSupabaseRows,
  fetchAllSupabaseRowsForIdChunks,
} from "@/lib/supabase-fetch-all";
import { createServiceRoleClient } from "@/lib/supabase-service";

const EMAIL_DELAY_MS = 250;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OutreachSkipReason =
  | "no_email"
  | "canary"
  | "not_finder_visible"
  | "no_slug"
  | "unsubscribed"
  | "cooldown"
  | "already_registered"
  | "test_email"
  | "capped";

export type DirectoryManualOutreachPreview = {
  manualId: string;
  name: string;
  email: string;
  slug: string;
  bookingCount: number;
  phoneClickCount: number;
  skipReason: OutreachSkipReason | null;
};

export type DirectoryManualOutreachJobResult = {
  dryRun: boolean;
  enabled: boolean;
  windowStart: string;
  windowEnd: string;
  candidates: number;
  sent: number;
  skipped: Record<OutreachSkipReason | "disabled", number>;
  failed: number;
  errors: { manualId: string; message: string }[];
  preview: DirectoryManualOutreachPreview[];
};

type ListingRow = {
  id: string;
  name: string | null;
  email: string | null;
  slug: string | null;
  finder_visible?: boolean | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptySkipCounts(): DirectoryManualOutreachJobResult["skipped"] {
  return {
    no_email: 0,
    canary: 0,
    not_finder_visible: 0,
    no_slug: 0,
    unsubscribed: 0,
    cooldown: 0,
    already_registered: 0,
    test_email: 0,
    capped: 0,
    disabled: 0,
  };
}

function bump(
  skipped: DirectoryManualOutreachJobResult["skipped"],
  reason: keyof DirectoryManualOutreachJobResult["skipped"],
): void {
  skipped[reason] += 1;
}

async function loadCountsInWindow(
  supabase: SupabaseClient,
  windowStart: Date,
  windowEnd: Date,
): Promise<OutreachCountRow[]> {
  const [bookings, phones] = await Promise.all([
    fetchAllSupabaseRows(() =>
      supabase
        .from("directory_manual_patient_booking_requests")
        .select("manual_id")
        .gte("created_at", windowStart.toISOString())
        .lt("created_at", windowEnd.toISOString()),
    ),
    fetchAllSupabaseRows(() =>
      supabase
        .from("directory_manual_call_to_book_clicks")
        .select("manual_id")
        .gte("created_at", windowStart.toISOString())
        .lt("created_at", windowEnd.toISOString()),
    ),
  ]);

  if (bookings.error) {
    throw new Error(`booking counts failed: ${bookings.error.message}`);
  }
  if (phones.error) {
    throw new Error(`phone click counts failed: ${phones.error.message}`);
  }

  return mergeOutreachCounts(
    countByManualId((bookings.data ?? []) as { manual_id?: string | null }[]),
    countByManualId((phones.data ?? []) as { manual_id?: string | null }[]),
  ).filter(shouldSendDirectoryOutreach);
}

function listingSkipReason(row: ListingRow): OutreachSkipReason | null {
  if (row.finder_visible === false) return "not_finder_visible";
  if (isDirectoryCanaryId(row.id) || isDirectoryCanarySlug(row.slug)) return "canary";
  const slug = String(row.slug ?? "").trim();
  if (!slug) return "no_slug";
  const email = normalizeOutreachEmail(row.email);
  if (!email) return "no_email";
  if (isTestDoctorRegistrationEmail(email)) return "test_email";
  return null;
}

export async function runDirectoryManualOutreachJob(opts?: {
  dryRun?: boolean;
  now?: Date;
  resendToOverride?: string | null;
}): Promise<DirectoryManualOutreachJobResult> {
  const now = opts?.now ?? new Date();
  const dryRun = Boolean(opts?.dryRun);
  const enabled = isDirectoryManualOutreachEnabled();
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - OUTREACH_WINDOW_MS);
  const siteUrl = getPublicBookingBaseUrl();
  const skipped = emptySkipCounts();
  const result: DirectoryManualOutreachJobResult = {
    dryRun,
    enabled,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    candidates: 0,
    sent: 0,
    skipped,
    failed: 0,
    errors: [],
    preview: [],
  };

  const supabase = createServiceRoleClient();
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  const qualifying = sortOutreachCandidates(
    await loadCountsInWindow(supabase, windowStart, windowEnd),
  );
  result.candidates = qualifying.length;
  if (qualifying.length === 0) return result;

  const qualifyingIds = qualifying.map((row) => row.manualId).filter((id) => UUID_RE.test(id));

  const { data: listings, error: listingError } = await fetchAllSupabaseRowsForIdChunks(
    qualifyingIds,
    (chunk) =>
      supabase
        .from("directory_manual")
        .select("id, name, email, slug, finder_visible")
        .in("id", chunk)
        .eq("is_archived", false),
  );
  if (listingError) {
    throw new Error(`listing lookup failed: ${listingError.message}`);
  }

  const listingById = new Map(
    ((listings ?? []) as ListingRow[]).map((row) => [row.id, row]),
  );

  const [{ data: unsubRows, error: unsubError }, { data: doctorRows, error: doctorError }] =
    await Promise.all([
      fetchAllSupabaseRows(() =>
        supabase.from("directory_manual_outreach_unsubscribed").select("email_normalized"),
      ),
      fetchAllSupabaseRows(() =>
        supabase
          .from("doctors")
          .select("email")
          .eq("status", "verified")
          .eq("is_test_profile", false)
          .not("email", "is", null),
      ),
    ]);

  if (unsubError) {
    const code = String((unsubError as { code?: string }).code ?? "");
    if (code !== "42P01" && !/does not exist/i.test(unsubError.message ?? "")) {
      throw new Error(`unsubscribe lookup failed: ${unsubError.message}`);
    }
  }
  if (doctorError) {
    throw new Error(`registered doctor lookup failed: ${doctorError.message}`);
  }

  const unsubscribed = new Set(
    ((unsubRows ?? []) as { email_normalized?: string | null }[])
      .map((row) => normalizeOutreachEmail(row.email_normalized))
      .filter(Boolean),
  );
  const registeredEmails = new Set(
    ((doctorRows ?? []) as { email?: string | null }[])
      .map((row) => normalizeOutreachEmail(row.email))
      .filter(Boolean),
  );

  const cooldownSince = new Date(now.getTime() - OUTREACH_COOLDOWN_MS).toISOString();
  const { data: recentSent, error: sentError } = await fetchAllSupabaseRowsForIdChunks(
    qualifyingIds,
    (chunk) =>
      supabase
        .from("directory_manual_outreach_sent")
        .select("manual_id, sent_at")
        .in("manual_id", chunk)
        .gte("sent_at", cooldownSince),
  );
  if (sentError) {
    const code = String((sentError as { code?: string }).code ?? "");
    if (code !== "42P01" && !/does not exist/i.test(sentError.message ?? "")) {
      throw new Error(`sent-log lookup failed: ${sentError.message}`);
    }
  }
  const recentlyEmailed = new Set(
    ((recentSent ?? []) as { manual_id?: string | null }[])
      .map((row) => String(row.manual_id ?? "").trim())
      .filter(Boolean),
  );

  const eligible: Array<
    OutreachCountRow & { listing: ListingRow; email: string; slug: string }
  > = [];

  for (const counts of qualifying) {
    const listing = listingById.get(counts.manualId);
    if (!listing) continue;
    const early = listingSkipReason(listing);
    if (early) {
      bump(skipped, early);
      continue;
    }
    const email = normalizeOutreachEmail(listing.email);
    const slug = String(listing.slug ?? "").trim();
    if (unsubscribed.has(email)) {
      bump(skipped, "unsubscribed");
      continue;
    }
    if (registeredEmails.has(email)) {
      bump(skipped, "already_registered");
      continue;
    }
    if (recentlyEmailed.has(listing.id)) {
      bump(skipped, "cooldown");
      continue;
    }
    eligible.push({ ...counts, listing, email, slug });
  }

  const ranked = sortOutreachCandidates(eligible);
  const toSend = ranked.slice(0, OUTREACH_MAX_SENDS_PER_RUN);
  skipped.capped = Math.max(0, ranked.length - toSend.length);

  const replyTo = getDirectoryOutreachReplyTo();
  const allowOverride = process.env.NODE_ENV !== "production";
  const previewOverride =
    allowOverride && opts?.resendToOverride?.trim() ? opts.resendToOverride.trim() : null;

  const liveSend = !dryRun && enabled;
  if (!dryRun && !enabled) {
    skipped.disabled = toSend.length;
  }

  const canSend = liveSend;
  const sendLimit = canSend && previewOverride ? 1 : toSend.length;

  for (let index = 0; index < toSend.length; index += 1) {
    const row = toSend[index]!;
    const name = String(row.listing.name ?? "").trim() || "there";
    result.preview.push({
      manualId: row.manualId,
      name,
      email: row.email,
      slug: row.slug,
      bookingCount: row.bookingCount,
      phoneClickCount: row.phoneClickCount,
      skipReason: null,
    });

    if (!canSend || index >= sendLimit) continue;

    try {
      await sendDirectoryManualOutreachEmail({
        to: previewOverride || row.email,
        siteUrl,
        professionalName: name,
        slug: row.slug,
        bookingCount: row.bookingCount,
        phoneClickCount: row.phoneClickCount,
        replyTo: replyTo,
      });
      const { error: insertErr } = await supabase.from("directory_manual_outreach_sent").insert({
        manual_id: row.manualId,
        email: row.email,
        booking_count: row.bookingCount,
        phone_click_count: row.phoneClickCount,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
      });
      if (insertErr) {
        throw new Error(insertErr.message);
      }
      result.sent += 1;
      await sleep(EMAIL_DELAY_MS);
    } catch (err) {
      result.failed += 1;
      result.errors.push({
        manualId: row.manualId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
