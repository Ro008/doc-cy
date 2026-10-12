import type { MouseEvent } from "react";

/**
 * Her DocCy access has ended (user, 2026-10-12): said on the pages where it explains
 * something (Dashboard, Agenda, Settings → Clinics), with one wording and one link to her
 * plan. Not closable: only a renewal changes it.
 */
export const ACCESS_ENDED_BANNER_TEXT =
  "Your DocCy access has ended, so online bookings are switched off. Patients can still call your clinic's phone from your profile. You can still answer the requests and handle the visits you already have.";
/** One line, for the agenda, where the height belongs to the calendar. */
export const ACCESS_ENDED_BANNER_SHORT_TEXT =
  "Your DocCy access has ended: no new bookings, online or manual. You can still answer requests and handle the visits you already have.";

const PLAN_HREF = "/settings?section=plan";

export function AccessEndedBanner({
  testId,
  short = false,
  onSeePlan,
}: {
  testId: string;
  short?: boolean;
  /** Settings switches the tab in place instead of loading the page again. */
  onSeePlan?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div
      role="status"
      data-testid={testId}
      className={`rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] px-4 text-sm text-amber-100 ${short ? "py-2.5" : "py-3"}`}
    >
      {short ? ACCESS_ENDED_BANNER_SHORT_TEXT : ACCESS_ENDED_BANNER_TEXT}{" "}
      <a
        href={PLAN_HREF}
        data-settings-section="plan"
        onClick={onSeePlan}
        className="whitespace-nowrap font-semibold text-amber-300 underline decoration-amber-300 underline-offset-2 hover:text-amber-200"
      >
        See your plan
      </a>
    </div>
  );
}
