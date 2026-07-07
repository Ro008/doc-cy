"use client";

import * as React from "react";
import { PendingLink } from "@/components/navigation/PendingLink";
import { emitOpenFeedback } from "@/lib/doccy-feedback";

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
      className={`text-[11px] font-medium text-ink-500 underline decoration-ink-300 underline-offset-2 transition hover:text-clinical-700 hover:decoration-clinical-300 ${className}`}
    >
      Report incorrect info
    </button>
  );
}

/** Low-emphasis path for the listed professional (finder is patient-first). */
export function ManualDirectoryDoctorClaimFooter({ className = "" }: { className?: string }) {
  return (
    <div className={`text-left ${className}`}>
      <p className="text-[11px] leading-snug text-ink-500">
        Are you this professional?{" "}
        <PendingLink
          href="/#founders-pricing"
          className="font-medium text-clinical-700 underline decoration-clinical-300 underline-offset-2 transition hover:text-clinical-600"
        >
          Activate online booking
        </PendingLink>
      </p>
    </div>
  );
}
