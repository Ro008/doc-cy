"use client";

import * as React from "react";
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
import {
  QUICK_DURATIONS,
  buildReviewDayTimeline,
  confirmedPath,
  reviewTimeRangeLabel,
  type ReviewBackTarget,
  type ReviewDayRow,
} from "@/lib/appointment-review";
import type { WeeklySchedule } from "@/lib/doctor-settings";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PendingLink } from "@/components/navigation/PendingLink";
import { DeclineRequestDialog } from "@/components/dashboard/DeclineRequestDialog";
import { PatientDetails } from "@/components/dashboard/PatientDetails";

type ScheduleForReview = {
  weeklySchedule: WeeklySchedule;
  breakStart: string | null;
  breakEnd: string | null;
};

type Props = {
  appointmentId: string;
  appointmentDatetimeIso: string;
  patientName: string;
  isNewPatient: boolean;
  /** Who the patient is (user, 2026-10-06): age, gender, first visit, phone, email. */
  patient?: {
    birthdate: string | null;
    gender: string | null;
    isNewPatient: boolean | null;
    phone: string | null;
    email: string | null;
  };
  requestedAgo: string | null;
  clinicName: string | null;
  /** "Mon 28 Sep" (Cyprus). */
  dayLabel: string;
  /** "Your hours: 09:00–17:00" or "You're not working that day". */
  dayHoursLabel: string;
  dayRows: ReviewDayRow[];
  reason: string;
  /** The service the patient picked (user, 2026-10-09); `reason` is then only their extra words. */
  serviceName?: string | null;
  initialDurationMinutes: number;
  scheduleForReview: ScheduleForReview | null;
  back: ReviewBackTarget;
  /** Opened from "Suggest other times": load the three times straight away. */
  openSuggestions: boolean;
  /** The request's clinic link; proposals default to it. */
  locationId?: string | null;
  /** Her clinics: she may propose times at another one (user, 2026-10-04). */
  clinicOptions?: { id: string; name: string }[];
};

/** She sends 1 to 3 times (user, 2026-10-04). */
const MAX_PROPOSED = 3;

const OTHER_DURATIONS = PROFESSIONAL_DURATION_OPTIONS.filter(
  (m) => !(QUICK_DURATIONS as readonly number[]).includes(m),
);

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

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "The patient";
}

export function AppointmentReviewClient({
  appointmentId,
  appointmentDatetimeIso,
  patientName,
  isNewPatient,
  patient,
  requestedAgo,
  clinicName,
  dayLabel,
  dayHoursLabel,
  dayRows,
  reason,
  serviceName = null,
  initialDurationMinutes,
  scheduleForReview,
  back,
  openSuggestions,
  locationId = null,
  clinicOptions = [],
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

  const [loadingAlternatives, setLoadingAlternatives] = React.useState(false);
  const [alternativesError, setAlternativesError] = React.useState<string | null>(null);
  /** The 1-3 times she will send: pre-filled with the first free ones, editable. */
  const [chosen, setChosen] = React.useState<string[] | null>(null);
  const [proposalClinicId, setProposalClinicId] = React.useState<string | null>(locationId);
  const [pickDate, setPickDate] = React.useState(() =>
    format(appointmentToCyprusDate(appointmentDatetimeIso), "yyyy-MM-dd"),
  );
  const [dayOptions, setDayOptions] = React.useState<string[] | null>(null);
  const [loadingDay, setLoadingDay] = React.useState(false);
  const [sendingProposal, setSendingProposal] = React.useState(false);
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const suggestRef = React.useRef<HTMLDivElement>(null);
  /** "suggest" when the doctor came to offer new times; "review" for a neutral look. */
  const [mode, setMode] = React.useState<"suggest" | "review">(openSuggestions ? "suggest" : "review");

  const rangeLabel = reviewTimeRangeLabel(appointmentDatetimeIso, duration);
  const startLabel = rangeLabel.split("–")[0];
  const busy = submitting || sendingProposal;

  const dayEntries = React.useMemo(
    () =>
      buildReviewDayTimeline(dayRows, {
        id: appointmentId,
        startIso: appointmentDatetimeIso,
        durationMinutes: duration,
        patientName,
      }),
    [dayRows, appointmentId, appointmentDatetimeIso, duration, patientName],
  );

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
    const timer = window.setTimeout(async () => {
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
          setCheckError(typeof data?.message === "string" ? data.message : "Could not check conflicts.");
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
      window.clearTimeout(timer);
    };
  }, [appointmentId, duration]);

  const clinicQuery = proposalClinicId ? `&locationId=${encodeURIComponent(proposalClinicId)}` : "";

  /** The first free times after the requested one, at the chosen clinic. */
  const loadAlternatives = React.useCallback(async () => {
    setAlternativesError(null);
    setChosen(null);
    setDayOptions(null);
    setLoadingAlternatives(true);
    try {
      const res = await fetch(
        `/api/appointments/${encodeURIComponent(appointmentId)}/alternative-slots?durationMinutes=${duration}${clinicQuery}`,
        { method: "GET", credentials: "include" },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAlternativesError(typeof data?.message === "string" ? data.message : "Could not load alternative times.");
        return;
      }
      const slots = (data as { slots?: string[] }).slots ?? [];
      if (slots.length === 0) {
        setAlternativesError(
          "No open times were found. Try a shorter visit length or extend your booking horizon in settings.",
        );
      }
      setChosen(slots.slice(0, MAX_PROPOSED));
    } catch {
      setAlternativesError("Could not load alternative times.");
    } finally {
      setLoadingAlternatives(false);
    }
  }, [appointmentId, duration, clinicQuery]);

  /** Every free time on one day, to add or swap. */
  async function loadDay() {
    setLoadingDay(true);
    setAlternativesError(null);
    try {
      const res = await fetch(
        `/api/appointments/${encodeURIComponent(appointmentId)}/alternative-slots?durationMinutes=${duration}&date=${pickDate}${clinicQuery}`,
        { method: "GET", credentials: "include" },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAlternativesError(typeof data?.message === "string" ? data.message : "Could not load free times.");
        return;
      }
      setDayOptions((data as { slots?: string[] }).slots ?? []);
    } catch {
      setAlternativesError("Could not load free times.");
    } finally {
      setLoadingDay(false);
    }
  }

  function addTime(iso: string) {
    setChosen((prev) => {
      const list = prev ?? [];
      if (list.includes(iso) || list.length >= MAX_PROPOSED) return list;
      return [...list, iso].sort();
    });
  }

  function removeTime(iso: string) {
    setChosen((prev) => (prev ?? []).filter((t) => t !== iso));
  }

  // Opened from "Suggest other times": show the times straight away.
  const autoLoaded = React.useRef(false);
  React.useEffect(() => {
    if (!openSuggestions || autoLoaded.current) return;
    autoLoaded.current = true;
    suggestRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    void loadAlternatives();
  }, [openSuggestions, loadAlternatives]);

  // Free times depend on the length and the clinic; a change needs a fresh search.
  const previousSearch = React.useRef(`${duration}|${proposalClinicId}`);
  React.useEffect(() => {
    const key = `${duration}|${proposalClinicId}`;
    if (previousSearch.current === key) return;
    previousSearch.current = key;
    if (chosen) void loadAlternatives();
  }, [duration, proposalClinicId, chosen, loadAlternatives]);

  async function handleConfirm() {
    if (hasConflict || checking || busy) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(appointmentId)}/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes: duration }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = typeof data?.message === "string" ? data.message : "Could not confirm this appointment.";
        setSubmitError(message);
        toast.error(message);
        setSubmitting(false);
        return;
      }
      router.push(confirmedPath(appointmentId, back.href === "/dashboard" ? "dashboard" : "agenda"));
      router.refresh();
    } catch {
      const message = "Something went wrong. Please try again.";
      setSubmitError(message);
      toast.error(message);
      setSubmitting(false);
    }
  }

  async function sendProposal() {
    if (busy) return;
    setAlternativesError(null);
    setSendingProposal(true);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(appointmentId)}/propose-reschedule`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMinutes: duration,
          proposedSlots: chosen ?? [],
          ...(proposalClinicId ? { locationId: proposalClinicId } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAlternativesError(typeof data?.message === "string" ? data.message : "Could not send the proposal.");
        toast.error(t("proposalsFailedToast"));
        setSendingProposal(false);
        return;
      }
      toast.success(t("proposalsSentToast"));
      router.push(back.href);
      router.refresh();
    } catch {
      setAlternativesError("Could not send the proposal.");
      toast.error(t("proposalsFailedToast"));
      setSendingProposal(false);
    }
  }

  const isOtherDuration = !(QUICK_DURATIONS as readonly number[]).includes(duration);
  const chipClass = (active: boolean) =>
    `rounded-xl border px-3 py-2 text-sm font-medium transition ${
      active
        ? "border-clinical-400/70 bg-clinical-500/20 text-clinical-100"
        : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-clinical-400/40 hover:text-slate-100"
    }`;

  const canAddMore = (chosen?.length ?? 0) < MAX_PROPOSED;
  const suggestionsPanel = (
    <div ref={suggestRef}>
      {alternativesError ? <p className="text-xs text-amber-200">{alternativesError}</p> : null}
      {loadingAlternatives && !chosen ? (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Finding the next open times…
        </p>
      ) : null}
      {chosen ? (
        <div className="space-y-3 rounded-2xl border border-clinical-400/30 bg-clinical-500/5 p-4 motion-safe:animate-fade-up">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-clinical-200/90">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Times to offer ({chosen.length} of up to {MAX_PROPOSED})
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              We pre-filled your next free times for a {formatProfessionalDurationLabel(duration)} visit. Remove any
              and add others from your free times.
            </p>
          </div>

          {clinicOptions.length > 1 ? (
            <label className="block text-xs font-medium text-slate-400">
              Clinic
              <select
                value={proposalClinicId ?? ""}
                onChange={(e) => setProposalClinicId(e.target.value || null)}
                disabled={busy}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100"
                data-testid="review-proposal-clinic"
              >
                {clinicOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.id === locationId ? " (requested)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <ul data-testid="review-suggested-times" className="space-y-2 text-sm text-slate-200">
            {chosen.map((iso, i) => (
              <li
                key={iso}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-ink-900/50 px-3 py-2"
              >
                <span>
                  <span className="text-slate-500">{i + 1}. </span>
                  {format(appointmentToCyprusDate(iso), "EEEE, d MMM · HH:mm", { locale: enUS })}
                </span>
                <button
                  type="button"
                  onClick={() => removeTime(iso)}
                  disabled={busy}
                  className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  aria-label={`Remove ${format(appointmentToCyprusDate(iso), "EEEE, d MMM · HH:mm", { locale: enUS })}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          {canAddMore ? (
            <div className="space-y-2 rounded-xl border border-slate-700/70 bg-ink-900/40 p-3">
              <p className="text-xs font-medium text-slate-300">Add a time</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={pickDate}
                  min={format(appointmentToCyprusDate(new Date().toISOString()), "yyyy-MM-dd")}
                  onChange={(e) => {
                    setPickDate(e.target.value);
                    setDayOptions(null);
                  }}
                  className="rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-1.5 text-sm text-slate-100 [color-scheme:dark]"
                  aria-label="Day"
                />
                <button
                  type="button"
                  onClick={() => void loadDay()}
                  disabled={busy || loadingDay || !pickDate}
                  className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                >
                  {loadingDay ? "Loading…" : "Show free times"}
                </button>
              </div>
              {dayOptions ? (
                dayOptions.filter((iso) => !chosen.includes(iso)).length > 0 ? (
                  <div className="flex flex-wrap gap-2" data-testid="review-day-options">
                    {dayOptions
                      .filter((iso) => !chosen.includes(iso))
                      .map((iso) => (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => addTime(iso)}
                          disabled={busy}
                          className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs tabular-nums text-slate-200 hover:border-clinical-400/50 hover:text-clinical-100"
                        >
                          {format(appointmentToCyprusDate(iso), "HH:mm")}
                        </button>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No free times that day.</p>
                )
              ) : null}
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-slate-500">
            We&apos;ll hold {chosen.length === 1 ? "this time" : "these times"} for {firstName(patientName)} until they
            answer (up to 24 h), and free up {startLabel} again. They get an email to pick one or decline.
          </p>
          <button
            type="button"
            disabled={busy || chosen.length === 0}
            onClick={() => void sendProposal()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-clinical-500/90 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-clinical-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendingProposal ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {sendingProposal ? "Sending…" : t("sendProposalToPatient")}
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Back to where the doctor came from: at the top, where she looks first (user, 2026-10-07). */}
      <PendingLink
        href={back.href}
        className="inline-flex items-center gap-1.5 rounded-xl border border-clinical-400/35 bg-clinical-500/10 px-3 py-2 text-sm font-semibold text-clinical-100 transition hover:border-clinical-400/50 hover:bg-clinical-500/20"
      >
        <span className="inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {back.label}
        </span>
      </PendingLink>

      {/* 3. Say what is being asked. */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-clinical-300/90">
          {`Booking request${requestedAgo ? ` · Requested ${requestedAgo}` : ""}`}
        </p>
        <h1 className="mt-2 text-xl font-semibold leading-snug text-slate-50 sm:text-2xl">
          {mode === "suggest"
            ? `Suggest other times to ${patientName}`
            : `${patientName} wants ${dayLabel}, ${startLabel}`}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {mode === "suggest" ? `They asked for ${dayLabel}, ${startLabel} · ` : ""}
          <span className="text-slate-500">Cyprus time</span>
        </p>
        {patient ? (
          <PatientDetails testId="review-patient" className="mt-3" {...patient} />
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs empty:hidden">
          {isNewPatient && !patient ? (
            <span className="rounded-full bg-wellness-500/15 px-2.5 py-1 font-semibold text-wellness-200">
              New patient
            </span>
          ) : null}
          {clinicName ? (
            <span className="rounded-full bg-slate-800 px-2.5 py-1 font-medium text-slate-300">{clinicName}</span>
          ) : null}
        </div>
      </header>

      <div className="rounded-2xl border border-clinical-500/25 bg-clinical-500/10 p-4">
        {serviceName ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-clinical-200/90">Service</p>
            <p data-testid="review-service" className="mt-2 text-sm font-semibold text-slate-100">
              {serviceName}
            </p>
          </>
        ) : null}
        {serviceName && !reason ? null : (
          <>
            <p
              className={`text-xs font-semibold uppercase tracking-wide text-clinical-200/90 ${serviceName ? "mt-3" : ""}`}
            >
              Reason for visit
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{reason || "—"}</p>
          </>
        )}
      </div>

      {/* 5. Length, with the resulting time range. */}
      <section aria-labelledby="review-length-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="review-length-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Visit length
          </h2>
          <p className="text-sm font-semibold tabular-nums text-clinical-200">{rangeLabel}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={duration === m}
              onClick={() => setDuration(m)}
              className={chipClass(duration === m)}
            >
              {formatProfessionalDurationLabel(m)}
            </button>
          ))}
          <label className={`${chipClass(isOtherDuration)} inline-flex items-center gap-1.5`}>
            <span className="sr-only">Other length</span>
            <select
              value={isOtherDuration ? duration : ""}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value) setDuration(value as ProfessionalDurationOption);
              }}
              className="cursor-pointer bg-transparent text-sm font-medium outline-none"
            >
              <option value="" disabled>
                Other…
              </option>
              {OTHER_DURATIONS.map((m) => (
                <option key={m} value={m} className="bg-slate-900 text-slate-100">
                  {formatProfessionalDurationLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {checking ? <p className="mt-2 text-xs text-slate-500">Checking your schedule…</p> : null}
        {checkError ? <p className="mt-2 text-xs text-amber-300">{checkError}</p> : null}
      </section>

      {/* 6. The day around the request. */}
      <section aria-labelledby="review-day-heading" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="review-day-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Your day · {dayLabel}
          </h2>
          <p className="text-xs text-slate-500">{dayHoursLabel}</p>
        </div>
        <ol data-testid="review-day-timeline" className="relative mt-3 space-y-2">
          <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-slate-700" />
          {dayEntries.map((entry) => (
            <li
              key={entry.id}
              className={`relative flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm ${
                entry.isRequest
                  ? entry.overlaps
                    ? "bg-amber-500/10 ring-1 ring-amber-400/40"
                    : "bg-clinical-500/10 ring-1 ring-clinical-400/40"
                  : ""
              }`}
            >
              <span
                aria-hidden
                className={`relative -ml-2 h-3 w-3 shrink-0 rounded-full ring-4 ring-slate-900 ${
                  entry.isRequest
                    ? entry.overlaps
                      ? "bg-amber-400"
                      : "bg-clinical-400"
                    : entry.overlaps
                      ? "bg-amber-400/70"
                      : "bg-slate-600"
                }`}
              />
              <span
                className={`w-24 shrink-0 font-semibold tabular-nums ${
                  entry.isRequest ? "text-slate-50" : entry.overlaps ? "text-amber-200" : "text-slate-400"
                }`}
              >
                {entry.rangeLabel}
              </span>
              <span className={`min-w-0 flex-1 truncate ${entry.isRequest ? "font-semibold text-slate-50" : "text-slate-300"}`}>
                {entry.patientName}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  entry.isRequest
                    ? "bg-clinical-500/20 text-clinical-100"
                    : entry.overlaps
                      ? "bg-amber-500/20 text-amber-100"
                      : "bg-slate-800 text-slate-400"
                }`}
              >
                {entry.isRequest
                  ? "This request"
                  : entry.overlaps
                    ? "Overlaps"
                    : entry.status === "confirmed"
                      ? "Confirmed"
                      : entry.status === "proposal"
                        ? "Awaiting patient"
                        : "Request"}
              </span>
            </li>
          ))}
        </ol>
        {dayEntries.length === 1 ? <p className="mt-2 text-xs text-slate-500">Nothing else booked that day.</p> : null}
      </section>

      {hasConflict && mode === "review" ? (
        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
          At this length the visit overlaps another appointment. Pick a shorter length, or suggest other times.
        </div>
      ) : null}
      {scheduleBoundaryWarning ? (
        <div
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
          role="status"
        >
          {t("scheduleOverlapWarning", { time: scheduleBoundaryWarning.boundaryTimeLabel })}
        </div>
      ) : null}
      {submitError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {submitError}
        </div>
      ) : null}

      {mode === "suggest" ? (
        /* Came to offer new times: that is the main action; the rest stays quiet. */
        <div className="space-y-4">
          {suggestionsPanel}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <button
              type="button"
              disabled={busy || loadingAlternatives}
              onClick={() => {
                // Close the whole form; "Suggest other times" opens it again, fresh.
                setChosen(null);
                setDayOptions(null);
                setAlternativesError(null);
                setMode("review");
              }}
              className="rounded-2xl border border-clinical-400/35 bg-clinical-500/10 px-4 py-2 font-medium text-clinical-100 transition hover:border-clinical-400/50 hover:bg-clinical-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Keep the original time instead
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeclineOpen(true)}
              className="rounded-2xl border border-red-500/30 px-4 py-2 font-medium text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        </div>
      ) : (
      /* 1 + 7. Every decision available, and what confirming does. */
      <div className="space-y-3">
        <button
          type="button"
          disabled={hasConflict || checking || busy}
          onClick={handleConfirm}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-clinical-400 px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/20 transition hover:bg-clinical-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {submitting ? "Confirming…" : `Confirm ${dayLabel}, ${rangeLabel}`}
        </button>
        <p className="text-center text-xs text-slate-500">
          {firstName(patientName)} will get an email confirmation.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loadingAlternatives || busy}
            onClick={() => {
              // Same view as when she arrives from the dashboard's "Suggest other times":
              // the form, with "Keep the original time instead" and Decline below it.
              setMode("suggest");
              void loadAlternatives();
              window.setTimeout(() => suggestRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-clinical-400/40 px-3 py-2.5 text-sm font-medium text-clinical-100 transition hover:border-clinical-400/70 hover:bg-clinical-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingAlternatives ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("proposeOtherTimes")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setDeclineOpen(true)}
            className="rounded-2xl border border-red-500/30 px-3 py-2.5 text-sm font-medium text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Decline
          </button>
        </div>

        {suggestionsPanel}
      </div>
      )}

      {declineOpen ? (
        <DeclineRequestDialog
          row={{ id: appointmentId, patient_name: patientName, appointment_datetime: appointmentDatetimeIso }}
          onClose={() => setDeclineOpen(false)}
          onDeclined={() => {
            setDeclineOpen(false);
            router.push(back.href);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
