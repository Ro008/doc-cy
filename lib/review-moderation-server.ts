import type { SupabaseClient } from "@supabase/supabase-js";

import {
  REVIEW_MODERATION_RECENT_LIMIT,
  reviewModerationItems,
  reviewStatusForAction,
  type ReviewModerationItem,
  type ReviewModerationRow,
} from "@/lib/review-moderation";

/**
 * Founders approve or reject patient reviews from the Requests tab (user, 2026-10-15).
 * Service role only (professional_reviews has no grants for anon/authenticated). Nobody is
 * notified of a decision.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNS =
  "id, professional_id, appointment_id, rating, comment, reviewer_name, reviewer_email, status, created_at, moderated_at";

export async function loadReviewsForModeration(
  service: SupabaseClient,
): Promise<{ pending: ReviewModerationItem[]; decided: ReviewModerationItem[] }> {
  const [pending, decided] = await Promise.all([
    service
      .from("professional_reviews")
      .select(COLUMNS)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    service
      .from("professional_reviews")
      .select(COLUMNS)
      .in("status", ["published", "rejected"])
      .not("moderated_at", "is", null)
      .order("moderated_at", { ascending: false })
      .limit(REVIEW_MODERATION_RECENT_LIMIT),
  ]);
  if (pending.error) throw new Error(`review moderation: ${pending.error.message}`);
  if (decided.error) throw new Error(`review moderation: ${decided.error.message}`);
  const rows = [...(pending.data ?? []), ...(decided.data ?? [])] as ReviewModerationRow[];
  if (rows.length === 0) return { pending: [], decided: [] };

  const proIds = [...new Set(rows.map((row) => row.professional_id))];
  const apptIds = [...new Set(rows.map((row) => row.appointment_id))];
  const [pros, appts] = await Promise.all([
    service.from("professionals").select("id, name, slug").in("id", proIds),
    service.from("appointments").select("id, appointment_datetime").in("id", apptIds),
  ]);
  if (pros.error) console.error("[DocCy] review moderation professionals", pros.error);
  if (appts.error) console.error("[DocCy] review moderation visits", appts.error);
  const professionals = new Map(
    ((pros.data ?? []) as { id: string; name: string | null; slug: string | null }[]).map((p) => [p.id, p]),
  );
  const visits = new Map(
    ((appts.data ?? []) as { id: string; appointment_datetime: string }[]).map((a) => [a.id, a.appointment_datetime]),
  );
  return reviewModerationItems(rows, professionals, visits);
}

export async function countPendingReviews(service: SupabaseClient): Promise<number> {
  const { count, error } = await service
    .from("professional_reviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) {
    console.error("[DocCy] pending reviews count", error);
    return 0;
  }
  return count ?? 0;
}

type ModerateResult =
  | { ok: true; status: "published" | "rejected" }
  | { ok: false; status: number; message: string };

/** Only a pending review can be decided, once: a rejection is final. */
export async function moderateReview(
  service: SupabaseClient,
  input: { reviewId: string; adminId: string; action: unknown },
): Promise<ModerateResult> {
  const next = reviewStatusForAction(input.action);
  if (!next) return { ok: false, status: 400, message: "Approve or reject." };
  if (!UUID.test(input.reviewId)) return { ok: false, status: 404, message: "That review does not exist." };

  const { data, error } = await service
    .from("professional_reviews")
    .update({ status: next, moderated_at: new Date().toISOString(), moderated_by: input.adminId })
    .eq("id", input.reviewId)
    .eq("status", "pending")
    .select("id");
  if (error) {
    console.error("[DocCy] review moderation", error);
    return { ok: false, status: 500, message: "Could not save the decision." };
  }
  if (data && data.length > 0) return { ok: true, status: next };

  const { data: existing } = await service
    .from("professional_reviews")
    .select("status")
    .eq("id", input.reviewId)
    .maybeSingle();
  if (!existing) return { ok: false, status: 404, message: "That review does not exist." };
  return { ok: false, status: 409, message: "This review was already decided." };
}
