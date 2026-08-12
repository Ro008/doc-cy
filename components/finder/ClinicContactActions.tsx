"use client";

import { RevealPhoneButton } from "@/components/finder/RevealPhoneButton";

type ClinicContactActionsProps = {
  clinicId: string;
  hasPhone: boolean;
  mapsHref: string | null;
};

export function ClinicContactActions({
  clinicId,
  hasPhone,
  mapsHref,
}: ClinicContactActionsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {mapsHref ? (
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm font-semibold text-ink-800 transition-none hover:border-clinical-300 hover:bg-clinical-50 hover:text-clinical-700"
        >
          Open in Google Maps
        </a>
      ) : null}
      <RevealPhoneButton
        kind="clinic"
        id={clinicId}
        hasPhone={hasPhone}
        className="inline-flex items-center rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm font-semibold text-ink-800 transition-none hover:border-clinical-300 hover:bg-clinical-50 hover:text-clinical-700 disabled:cursor-wait disabled:opacity-60"
        revealedClassName="inline-flex items-center rounded-lg border border-clinical-200 bg-clinical-50 px-3 py-2 text-sm font-semibold tabular-nums text-clinical-800"
      />
    </div>
  );
}
