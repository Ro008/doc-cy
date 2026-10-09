import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import { BookingLinkCard, BookingLinkShell, BookingLinkText } from "@/components/booking/BookingLinkPanels";
import { ReviewFormClient } from "@/components/booking/ReviewFormClient";
import { appointmentToCyprusDate } from "@/lib/appointments";
import { professionalSignedInOnPage } from "@/lib/booking-signed-in-guard";
import { loadPatientReviewContext } from "@/lib/patient-review";
import { reviewDisplayName } from "@/lib/review-display-name";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Review your visit | DocCy", robots: { index: false, follow: false } };

/**
 * The page the review email's link opens (user, 2026-10-04). Opening it changes nothing;
 * the form's button publishes the review.
 */
export default async function PatientReviewPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token?.trim() ?? "";
  const service = createServiceRoleClient();

  // A signed-in professional can't leave a review from a patient's link (user, 2026-10-08):
  // it could be her own visit. Nothing is looked up or used up: the patient can still use it
  // signed out.
  if (service && (await professionalSignedInOnPage(service))) {
    return (
      <BookingLinkShell>
        <BookingLinkCard title="You're signed in as a professional" testId="review-professional">
          <BookingLinkText>
            Professionals can&apos;t leave a review as a patient. No review has been sent. To leave it, open this link
            while signed out (a private window works), or sign out of DocCy first.
          </BookingLinkText>
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  const ctx = service
    ? await loadPatientReviewContext(service, token).catch(() => ({ kind: "invalid" as const }))
    : ({ kind: "invalid" } as const);

  if (ctx.kind !== "visit") {
    const copy = {
      used: ["This link was already used", "A review was already sent with this link. Thank you!"],
      expired: ["This link has expired", "Review links work for 30 days after the visit."],
      invalid: ["This link doesn't work", "It may be incomplete or wrong. Open the email again and tap the full link."],
    }[ctx.kind];
    return (
      <BookingLinkShell>
        <BookingLinkCard title={copy[0]} testId={`review-${ctx.kind}`}>
          <BookingLinkText>{copy[1]}</BookingLinkText>
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  if (ctx.eligibility !== "ok") {
    return (
      <BookingLinkShell>
        <BookingLinkCard
          title={ctx.eligibility === "already_reviewed" ? "This visit already has a review" : "Reviews aren't open for this visit"}
          testId={ctx.eligibility === "already_reviewed" ? "review-used" : "review-unavailable"}
        >
          <BookingLinkText>
            {ctx.eligibility === "already_reviewed"
              ? "Thank you, your review was already received."
              : "A review can only be left after a visit that took place."}
          </BookingLinkText>
        </BookingLinkCard>
      </BookingLinkShell>
    );
  }

  return (
    <BookingLinkShell>
      <ReviewFormClient
        token={token}
        professionalName={ctx.professional.name}
        visitDayLabel={format(appointmentToCyprusDate(ctx.appointment.appointment_datetime), "EEEE, d MMMM yyyy", {
          locale: enUS,
        })}
        displayName={reviewDisplayName(ctx.appointment.patient_name)}
      />
    </BookingLinkShell>
  );
}
