"use client";

import * as React from "react";
import { toast } from "sonner";
import { PendingLink } from "@/components/navigation/PendingLink";
import { emitOpenFeedback } from "@/lib/doccy-feedback";

type ManualIdProps = {
  manualId: string;
};

function patientBookingRequestErrorMessage(
  reason: string | undefined,
  status: number,
): string {
  if (status === 503 || reason === "service_role_not_configured") {
    return "This action is not available on this server (missing configuration).";
  }
  if (reason === "manual_not_found") {
    return "This listing is no longer available.";
  }
  if (reason === "invalid_manual_id") {
    return "Something went wrong with this card. Please refresh the page.";
  }
  if (reason === "dedupe_lookup_failed") {
    return "We could not record your vote. Please try again.";
  }
  if (reason === "table_missing") {
    return "This feature is not active yet: the database needs the latest DocCy migration (table directory_manual_patient_booking_requests).";
  }
  if (reason === "insert_failed" || reason === "permission_denied") {
    return "We could not save your vote. If you run DocCy, apply pending Supabase migrations and try again.";
  }
  return "Could not record your vote. Please try again.";
}

function useVoteForOnlineBooking(manualId: string) {
  const [pending, setPending] = React.useState(false);

  async function submit() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/directory-manual/patient-booking-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reason?: string;
        duplicate?: boolean;
      };
      if (!res.ok || !data.ok) {
        toast.error(patientBookingRequestErrorMessage(data.reason, res.status));
        return;
      }
      toast.success("Thanks for your vote! We'll let them know.");
    } catch {
      toast.error("Could not record your vote. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return { pending, submit };
}

/** Primary patient CTA: place directly under the intro line for reading flow. */
export function ManualDirectoryVoteButton({
  manualId,
  monthlyRequestCount = 0,
  className = "",
}: ManualIdProps & { monthlyRequestCount?: number; className?: string }) {
  const { pending, submit } = useVoteForOnlineBooking(manualId);
  const showScarcityBadge = monthlyRequestCount > 0;
  const patientLabel = monthlyRequestCount === 1 ? "patient" : "patients";

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      {showScarcityBadge ? (
        <p
          className="rounded-lg border border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-3 py-2 text-center text-xs font-bold leading-snug text-amber-950 shadow-[0_2px_8px_rgba(245,158,11,0.18)] ring-1 ring-amber-200/70"
          role="status"
        >
          🔥 {monthlyRequestCount} {patientLabel} requested online booking this month
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="inline-flex w-full items-center justify-center rounded-xl bg-clinical-500 px-5 py-3.5 text-base font-bold text-white shadow-[0_4px_14px_rgba(11,123,181,0.35)] transition hover:bg-clinical-400 hover:shadow-[0_6px_18px_rgba(11,123,181,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Requesting..." : "Request Digital Booking"}
      </button>
    </div>
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
