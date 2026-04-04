"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { appointmentToCyprusDate } from "@/lib/appointments";
import {
  PROFESSIONAL_DURATION_OPTIONS,
  formatProfessionalDurationLabel,
  type ProfessionalDurationOption,
} from "@/lib/professional-appointment-durations";
import { getScheduleOverlapWarning } from "@/lib/appointment-review-schedule-warn";
import type { WeeklySchedule } from "@/lib/doctor-settings";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

type ScheduleForReview = {
  weeklySchedule: WeeklySchedule;
  breakStart: string | null;
  breakEnd: string | null;
};

type Props = {
  appointmentId: string;
  appointmentDatetimeIso: string;
  professionalFirstName: string;
  patientName: string;
  requestedDateLabel: string;
  requestedTimeLabel: string;
  reason: string;
  initialDurationMinutes: number;
  scheduleForReview: ScheduleForReview | null;
};

function closestAllowedDuration(m: number): ProfessionalDurationOption {
  const allowed = [...PROFESSIONAL_DURATION_OPTIONS];
  let best = allowed[0]!;
  let bestDist = Math.abs(m - best);
  for (const opt of allowed) {
    const d = Math.abs(m - opt);
    if (d < bestDist) {
      best = opt;
      bestDist = d;
    }
  }
  return best;
}

export function AppointmentReviewClient({
  appointmentId,
  appointmentDatetimeIso,
  professionalFirstName,
  patientName,
  requestedDateLabel,
  requestedTimeLabel,
  reason,
  initialDurationMinutes,
  scheduleForReview,
}: Props) {
  const router = useRouter();
  const t = useTranslations("AppointmentReview");
  const [duration, setDuration] = React.useState<ProfessionalDurationOption>(
    () => closestAllowedDuration(initialDurationMinutes),
  );
  const [checking, setChecking] = React.useState(false);
  const [hasConflict, setHasConflict] = React.useState(false);
  const [checkError, setCheckError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const [counterOfferOpen, setCounterOfferOpen] = React.useState(false);
  const [loadingAlternatives, setLoadingAlternatives] = React.useState(false);
  const [alternativesError, setAlternativesError] = React.useState<
    string | null
  >(null);
  const [previewSlots, setPreviewSlots] = React.useState<string[] | null>(null);
  const [sendingProposal, setSendingProposal] = React.useState(false);

  const scheduleBoundaryWarning = React.useMemo(() => {
    if (!scheduleForReview) return null;
    return getScheduleOverlapWarning(
      appointmentDatetimeIso,
      duration,
      scheduleForReview.weeklySchedule,
      scheduleForReview.breakStart,
      scheduleForReview.breakEnd,
    );
  }, [appointmentDatetimeIso, duration, scheduleForReview]);

  React.useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setChecking(true);
      setCheckError(null);
      try {
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(appointmentId)}/overlap?durationMinutes=${duration}`,
          { method: "GET", credentials: "include" },
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setCheckError(
            typeof data?.message === "string"
              ? data.message
              : "Could not check conflicts.",
          );
          setHasConflict(true);
          return;
        }
        setHasConflict(Boolean(data?.hasConflict));
      } catch {
        if (!cancelled) {
          setCheckError("Could not check conflicts.");
          setHasConflict(true);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [appointmentId, duration]);

  React.useEffect(() => {
    if (!hasConflict) {
      setCounterOfferOpen(false);
      setPreviewSlots(null);
      setAlternativesError(null);
    }
  }, [hasConflict]);

  async function handleConfirm() {
    if (hasConflict || checking) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/appointments/${encodeURIComponent(appointmentId)}/confirm`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationMinutes: duration }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(
          typeof data?.message === "string"
            ? data.message
            : "Could not confirm this appointment.",
        );
        setSubmitting(false);
        return;
      }
      router.push("/agenda");
      router.refresh();
      return;
    } catch {
      setSubmitError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  async function loadAlternatives() {
    setAlternativesError(null);
    setPreviewSlots(null);
    setLoadingAlternatives(true);
    try {
      const res = await fetch(
        `/api/appointments/${encodeURIComponent(appointmentId)}/alternative-slots?durationMinutes=${duration}`,
        { method: "GET", credentials: "include" },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAlternativesError(
          typeof data?.message === "string"
            ? data.message
            : "Could not load alternative times.",
        );
        setLoadingAlternatives(false);
        return;
      }
      const slots = (data as { slots?: string[] }).slots ?? [];
      if (slots.length < 3) {
        setAlternativesError(
          "Not enough open times were found. Try a shorter visit length or extend your booking horizon in settings.",
        );
        setLoadingAlternatives(false);
        return;
      }
      setPreviewSlots(slots.slice(0, 3));
      setCounterOfferOpen(true);
    } catch {
      setAlternativesError("Could not load alternative times.");
    } finally {
      setLoadingAlternatives(false);
    }
  }

  async function sendProposal() {
    if (sendingProposal) return;
    setAlternativesError(null);
    setSendingProposal(true);
    try {
      const res = await fetch(
        `/api/appointments/${encodeURIComponent(appointmentId)}/propose-reschedule`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationMinutes: duration }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAlternativesError(
          typeof data?.message === "string"
            ? data.message
            : "Could not send the proposal.",
        );
        toast.error(t("proposalsFailedToast"));
        setSendingProposal(false);
        return;
      }
      toast.success(t("proposalsSentToast"));
      router.push("/agenda");
      router.refresh();
      return;
    } catch {
      setAlternativesError("Could not send the proposal.");
      toast.error(t("proposalsFailedToast"));
      setSendingProposal(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">
          Review request
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-50">
          Hi {professionalFirstName}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Check the reason below, adjust the visit length if you need to, then
          confirm.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Patient
        </p>
        <p className="mt-1 text-base font-medium text-slate-100">
          {patientName}
        </p>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
          Requested time
        </p>
        <p className="mt-1 text-sm text-slate-200">
          {requestedDateLabel} · {requestedTimeLabel}{" "}
          <span className="text-slate-500">(Cyprus time)</span>
        </p>
      </div>

      <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 shadow-inner shadow-sky-950/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-200/90">
          Reason for visit
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
          {reason || "—"}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Visit duration
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Defaults to your current slot length; change if this visit needs more
          or less time.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PROFESSIONAL_DURATION_OPTIONS.map((m) => {
            const active = duration === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setDuration(m)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-100"
                    : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600"
                }`}
              >
                {formatProfessionalDurationLabel(m)}
              </button>
            );
          })}
        </div>
        {checking ? (
          <p className="mt-2 text-xs text-slate-500">Checking your schedule…</p>
        ) : null}
        {checkError ? (
          <p className="mt-2 text-xs text-amber-300">{checkError}</p>
        ) : null}
      </div>

      {hasConflict ? (
        <div
          className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          This duration overlaps another appointment. Choose a shorter length,
          confirm if you adjust it, or propose three alternative times for the
          patient.
        </div>
      ) : null}

      {submitError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {submitError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {scheduleBoundaryWarning ? (
          <div
            className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
            role="status"
          >
            {t("scheduleOverlapWarning", {
              time: scheduleBoundaryWarning.boundaryTimeLabel,
            })}
          </div>
        ) : null}
        <button
          type="button"
          disabled={hasConflict || checking || submitting}
          onClick={handleConfirm}
          className="w-full rounded-2xl bg-emerald-400 px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
        >
          {submitting ? "Confirming…" : "Confirm appointment"}
        </button>

        {hasConflict ? (
          <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
            <button
              type="button"
              disabled={checking || loadingAlternatives || sendingProposal}
              onClick={() => {
                void loadAlternatives();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAlternatives ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Finding times…
                </>
              ) : (
                t("proposeOtherTimes")
              )}
            </button>

            {alternativesError ? (
              <p className="text-xs text-amber-200">{alternativesError}</p>
            ) : null}

            {counterOfferOpen && previewSlots && previewSlots.length >= 3 ? (
              <div className="space-y-3 border-t border-slate-700/80 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Next three openings (
                  {formatProfessionalDurationLabel(duration)})
                </p>
                <ul className="space-y-2 text-sm text-slate-200">
                  {previewSlots.map((iso, i) => (
                    <li
                      key={iso}
                      className="rounded-xl border border-slate-700/80 bg-slate-950/50 px-3 py-2"
                    >
                      <span className="text-slate-500">{i + 1}. </span>
                      {format(
                        appointmentToCyprusDate(iso),
                        "EEEE, d MMM yyyy · HH:mm",
                        {
                          locale: enUS,
                        },
                      )}{" "}
                      <span className="text-slate-500">(Cyprus)</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">
                  {t("counterOfferEmailHint", { patientName })}
                </p>
                <button
                  type="button"
                  disabled={sendingProposal}
                  onClick={() => void sendProposal()}
                  className="w-full rounded-2xl bg-sky-500/90 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingProposal ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Sending…
                    </span>
                  ) : (
                    t("sendProposalToPatient")
                  )}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Link
        href="/agenda"
        className="block text-center text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
      >
        Back to agenda
      </Link>
    </div>
  );
}
