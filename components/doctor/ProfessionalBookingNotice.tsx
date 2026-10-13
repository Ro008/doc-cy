import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { BookingViewerMode } from "@/lib/booking-viewer";

/**
 * Shown instead of the booking calendar to a signed-in professional (user, 2026-10-06):
 * on her own profile it points to manual booking; on a colleague's it says to sign out
 * to book as a patient.
 */
export async function ProfessionalBookingNotice({ mode }: { mode: Exclude<BookingViewerMode, "patient"> }) {
  const t = await getTranslations("BookingPage");
  const own = mode === "own_profile";
  return (
    <div
      data-testid={own ? "booking-own-profile-notice" : "booking-professional-notice"}
      className="rounded-2xl border border-clinical-200 bg-clinical-50/70 p-5 text-ink-700"
    >
      <h2 className="text-base font-semibold text-ink-900">
        {own ? t("ownProfileNoticeTitle") : t("professionalNoticeTitle")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed">{own ? t("ownProfileNoticeBody") : t("professionalNoticeBody")}</p>
      {own ? (
        <Link
          href="/agenda?manual=1"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-clinical-600 px-4 text-sm font-semibold text-white transition hover:bg-clinical-700"
        >
          {t("ownProfileNoticeLink")}
        </Link>
      ) : null}
    </div>
  );
}
