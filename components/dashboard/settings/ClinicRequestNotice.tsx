"use client";

import * as React from "react";
import { X } from "lucide-react";
import { BusyLabel } from "@/components/dashboard/settings/BusyLabel";
import { useDismissibleDenial } from "@/components/dashboard/settings/useDismissibleDenial";
import type { DeniedClinicRequest } from "@/lib/clinic-requests";
import { profileChangeRequestDate } from "@/lib/profile-change-requests";

/**
 * The state of a clinic request in Settings (user, 2026-10-11), the same way as a name
 * or photo request: while it waits, the date it was sent and "Withdraw request"; when
 * her latest one was denied, the reason, until she dismisses it or asks again.
 */
export function ClinicRequestNotice({
  storageKind,
  pending,
  denied: initialDenied,
  deniedWhat,
  onWithdraw,
  testId,
}: {
  /** Where this browser remembers a dismissed denial, e.g. "clinic-add". */
  storageKind: string;
  pending: { createdAt: string; summary: string } | null;
  denied: DeniedClinicRequest | null;
  /** "request to add …" / "request to change this clinic’s details". */
  deniedWhat: string;
  /** Withdraws the waiting request; resolves once the page shows it gone. */
  onWithdraw: () => Promise<void>;
  testId: string;
}) {
  const [denied, dismissDenied] = useDismissibleDenial(storageKind, initialDenied);
  const [withdrawing, setWithdrawing] = React.useState(false);

  if (pending) {
    return (
      <div
        data-testid={`${testId}-pending`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-sm text-amber-100"
      >
        <span className="min-w-0 flex-1">
          <span className="font-semibold">Request sent on {profileChangeRequestDate(pending.createdAt)}</span>
          <span className="text-amber-100/80"> · waiting for DocCy’s approval · {pending.summary}</span>
        </span>
        <button
          type="button"
          onClick={async () => {
            setWithdrawing(true);
            try {
              await onWithdraw();
            } finally {
              setWithdrawing(false);
            }
          }}
          disabled={withdrawing}
          aria-busy={withdrawing}
          className="text-sm font-semibold text-amber-200 underline-offset-4 transition hover:text-amber-50 hover:underline disabled:opacity-60 aria-busy:cursor-progress"
        >
          <BusyLabel busy={withdrawing} busyText="Withdrawing…">
            Withdraw request
          </BusyLabel>
        </button>
      </div>
    );
  }
  if (!denied) return null;
  return (
    <div
      data-testid={`${testId}-denied`}
      className="flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/[0.06] px-3.5 py-2.5 text-sm text-red-100"
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Your {deniedWhat} was not approved</span>
        <span className="text-red-100/80"> on {profileChangeRequestDate(denied.decidedAt)}.</span>
        <span className="mt-0.5 block text-red-100/90">Reason: {denied.reason}</span>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissDenied}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-200/80 transition hover:bg-white/5 hover:text-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
