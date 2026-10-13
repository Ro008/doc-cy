import { isNoShowAttendance } from "@/lib/appointment-attendance";

/**
 * Verified reviews (user, 2026-10-04): one per attended visit (professional_reviews,
 * appointment_id unique). The scheduled job emails the link 24 h after the visit unless she
 * marked a no-show. The link works once for 30 days; the typed email must match the
 * visit's. Shown publicly as "Maria K." with rating, comment and date; the email never.
 */
export const REVIEW_LINK_DAYS = 30;
export const REVIEW_COMMENT_MAX = 2000;

type ReviewParse =
  | { ok: true; rating: number; comment: string; email: string; code?: undefined; message?: undefined }
  | {
      ok: false;
      code: "rating" | "comment" | "email_mismatch";
      message: string;
      rating?: undefined;
      comment?: undefined;
      email?: undefined;
    };

export function parseReviewSubmission(
  body: { rating?: unknown; comment?: unknown; email?: unknown },
  visitEmail: string | null | undefined,
): ReviewParse {
  const rating = body.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, code: "rating", message: "Please choose a rating from 1 to 5 stars." };
  }
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!comment) return { ok: false, code: "comment", message: "Please write a few words about your visit." };
  if (comment.length > REVIEW_COMMENT_MAX) {
    return { ok: false, code: "comment", message: `Please keep your review under ${REVIEW_COMMENT_MAX} characters.` };
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const expected = String(visitEmail ?? "").trim().toLowerCase();
  if (!email || !expected || email !== expected) {
    return {
      ok: false,
      code: "email_mismatch",
      message: "That isn't the email this appointment was booked with.",
    };
  }
  return { ok: true, rating, comment, email };
}

export function reviewEligibility(appt: {
  status: string | null | undefined;
  attendance: string | null | undefined;
}): "ok" | "no_show" | "not_visited" {
  if (String(appt.status ?? "").trim().toUpperCase() !== "CONFIRMED") return "not_visited";
  if (isNoShowAttendance(appt.attendance)) return "no_show";
  return "ok";
}
