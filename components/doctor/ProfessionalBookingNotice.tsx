import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { BookingViewerMode } from "@/lib/booking-viewer";

/**
 * Shown instead of the booking calendar to a signed-in professional (user, 2026-10-06):
 * on her own profile it points to manual booking; on a colleague's it says to sign out
 * to book as a patient. Only on the public profile: drawn in its theme (light/dark, her colour).
 */
export async function ProfessionalBookingNotice({ mode }: { mode: Exclude<BookingViewerMode, "patient"> }) {
  const t = await getTranslations("BookingPage");
  const own = mode === "own_profile";
  return (
    <div
      data-testid={own ? "booking-own-profile-notice" : "booking-professional-notice"}
      className="rounded-3xl border border-profile-border bg-accent-soft p-5 text-profile-body"
    >
      <h2 className="text-base font-bold text-profile-text">
        {own ? t("ownProfileNoticeTitle") : t("professionalNoticeTitle")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed">{own ? t("ownProfileNoticeBody") : t("professionalNoticeBody")}</p>
      {own ? (
        <Link
          href="/agenda?manual=1"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent-cta px-4 text-sm font-bold text-accent-on-cta transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t("ownProfileNoticeLink")}
        </Link>
      ) : null}
    </div>
  );
}
