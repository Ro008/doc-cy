import { reviewDisplayName } from "@/lib/review-display-name";

/**
 * Review moderation (user, 2026-10-15): a patient's review is stored as pending and only
 * shows once a founder approves it (published). A rejection is final and nobody is told:
 * not the patient, not the professional. No emails either way.
 */

/** How many approved/rejected reviews the Requests tab lists under "Recent decisions". */
export const REVIEW_MODERATION_RECENT_LIMIT = 20;

export type ReviewModerationAction = "approve" | "reject";

export function reviewStatusForAction(action: unknown): "published" | "rejected" | null {
  if (action === "approve") return "published";
  if (action === "reject") return "rejected";
  return null;
}

export type ReviewModerationRow = {
  id: string;
  professional_id: string;
  appointment_id: string;
  rating: number;
  comment: string;
  reviewer_name: string;
  reviewer_email: string;
  status: string;
  created_at: string;
  moderated_at: string | null;
};

export type ReviewModerationItem = {
  id: string;
  status: "pending" | "published" | "rejected";
  rating: number;
  comment: string;
  reviewerName: string;
  reviewerEmail: string;
  /** How the profile shows the patient: "Maria K.". */
  displayName: string;
  professional: { id: string; name: string; slug: string | null };
  visitAt: string | null;
  createdAt: string;
  moderatedAt: string | null;
};

/**
 * The founders' queue: pending reviews oldest first, then the latest decisions. Hidden
 * reviews, and published ones from before moderation (no moderated_at), aren't decisions.
 */
export function reviewModerationItems(
  rows: ReadonlyArray<ReviewModerationRow>,
  professionals: ReadonlyMap<string, { name: string | null; slug: string | null }>,
  visitAtByAppointment: ReadonlyMap<string, string>,
): { pending: ReviewModerationItem[]; decided: ReviewModerationItem[] } {
  const item = (row: ReviewModerationRow): ReviewModerationItem => {
    const pro = professionals.get(row.professional_id);
    return {
      id: row.id,
      status: row.status as ReviewModerationItem["status"],
      rating: row.rating,
      comment: row.comment,
      reviewerName: row.reviewer_name,
      reviewerEmail: row.reviewer_email,
      displayName: reviewDisplayName(row.reviewer_name),
      professional: {
        id: row.professional_id,
        name: pro?.name?.trim() || "Unknown professional",
        slug: pro?.slug ?? null,
      },
      visitAt: visitAtByAppointment.get(row.appointment_id) ?? null,
      createdAt: row.created_at,
      moderatedAt: row.moderated_at,
    };
  };
  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  const pending = rows
    .filter((row) => row.status === "pending")
    .sort((a, b) => time(a.created_at) - time(b.created_at))
    .map(item);
  const decided = rows
    .filter((row) => (row.status === "published" || row.status === "rejected") && row.moderated_at)
    .sort((a, b) => time(b.moderated_at) - time(a.moderated_at))
    .slice(0, REVIEW_MODERATION_RECENT_LIMIT)
    .map(item);
  return { pending, decided };
}
