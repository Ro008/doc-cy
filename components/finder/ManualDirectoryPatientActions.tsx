"use client";

import * as React from "react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { emitOpenFeedback } from "@/lib/doccy-feedback";
import { formatFinderRequestBadgeLabel } from "@/lib/finder-booking-request-stats";
import { registerClaimPath } from "@/lib/claim-directory-professional";

export function ManualDirectoryMonthlyRequestBadge({
  monthlyRequestCount,
  className = "",
}: {
  monthlyRequestCount: number;
  className?: string;
}) {
  const label = formatFinderRequestBadgeLabel(monthlyRequestCount);
  if (!label) return null;

  return (
    <p
      className={`rounded-lg border border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-3 py-2 text-center text-xs font-bold leading-snug text-amber-950 shadow-[0_2px_8px_rgba(245,158,11,0.18)] ring-1 ring-amber-200/70 ${className}`}
      role="status"
    >
      {label}
    </p>
  );
}

type ManualListingContext = {
  displayName: string;
  specialty: string;
  district: string;
};

function buildIncorrectInfoMessage(ctx: ManualListingContext): string {
  return [
    "I'm reporting incorrect information about a Health Finder listing.",
    "",
    `Professional: ${ctx.displayName}`,
    `Specialty: ${ctx.specialty}`,
    `District: ${ctx.district}`,
    "",
    "What seems incorrect:",
    "",
  ].join("\n");
}

/**
 * `before:` expands the tap target past the 11px text to clear WCAG 2.5.8 (24px)
 * without changing the rendered size or shifting the footer.
 */
const REPORT_LINK_CLASS =
  "relative text-[11px] font-medium text-ink-500 underline decoration-ink-300 underline-offset-2 transition before:absolute before:-inset-x-2 before:-inset-y-2 before:content-[''] hover:text-clinical-700 hover:decoration-clinical-300";

/** Opens the global contact / feedback form with listing context pre-filled. */
export function ManualDirectoryReportIncorrectInfoLink({
  displayName,
  specialty,
  district,
  className = "",
}: ManualListingContext & { className?: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        emitOpenFeedback({
          subject: "General Question",
          message: buildIncorrectInfoMessage({
            displayName,
            specialty,
            district,
          }),
        })
      }
      className={`${REPORT_LINK_CLASS} ${className}`}
    >
      Report incorrect info
    </button>
  );
}

/** High-visibility claim prompt for the listed professional, so an unclaimed profile is unmistakable. */
export function ManualDirectoryDoctorClaimFooter({
  professionalId,
  className = "",
}: {
  professionalId: string;
  className?: string;
}) {
  return (
    <div className={`text-left ${className}`}>
      <PendingLink
        href={registerClaimPath(professionalId)}
        className="inline-block rounded-lg border border-clinical-300 bg-clinical-50 px-3 py-1.5 text-[11px] leading-snug transition hover:border-clinical-400 hover:bg-clinical-100"
      >
        <span className="font-medium text-ink-600">Are you this professional?</span>{" "}
        <span className="font-bold text-clinical-800">Claim this Profile</span>
      </PendingLink>
    </div>
  );
}
