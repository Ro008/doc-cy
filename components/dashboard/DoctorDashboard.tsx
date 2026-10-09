"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { AlertTriangle, CalendarPlus, Check, CheckCircle2, ChevronDown, Loader2, Phone, X } from "lucide-react";
import { ManualBookingFlow } from "@/components/agenda/ManualBookingFlow";
import { CY_TZ } from "@/lib/appointments";
import {
  clinicIdForAppointment,
  type AgendaClinic,
  type AgendaWorkingHours,
} from "@/lib/agenda-clinics";
import { type PausedClinicNotice,
  DASHBOARD_NEEDS_ANSWER_ID,
  buildTodaySchedule,
  dashboardClinicTag,
  awaitingPatientSummary,
  dashboardGreeting,
  nowMarkerPosition,
  requestedAgoLabel,
  selectAwaitingPatient,
  selectPendingRequests,
  startsInLabel,
  todaySummaryLabel,
  type DashboardAppointmentRow,
  type DashboardClinicTag,
  type TodayScheduleItem,
  type TodayWorkingWindow,
} from "@/lib/doctor-dashboard";
import { isAllowedProfessionalDuration } from "@/lib/professional-appointment-durations";
import { emitPendingRequestsCount } from "@/lib/pending-requests-count";
import { reviewPathFromDashboard } from "@/lib/appointment-review";
import { agendaHighlightHref } from "@/lib/agenda-highlight";
import { DeclineRequestDialog } from "@/components/dashboard/DeclineRequestDialog";
import { VisitDetailsDialog } from "@/components/agenda/VisitDetailsDialog";
import { visitDetailsFromRow } from "@/lib/visit-details";
import { useDeviceDismissals } from "@/components/dashboard/useDeviceDismissals";
import { useNewRequests } from "@/components/dashboard/useNewRequests";
import { newRequestsLabel } from "@/lib/dashboard-new-requests";
import {
  MISSED_REQUESTS_DISMISSED_KEY,
  MISSED_REQUESTS_SHOWN,
  missedRequestSummary,
  selectMissedRequests,
} from "@/lib/missed-requests";
import { splitMonthDayItems } from "@/lib/agenda-calendar";
import { MANUAL_BOOKING_HINT, MANUAL_BOOKING_LABEL } from "@/lib/manual-booking-copy";
import {
  NO_NEW_TIME_DISMISSED_KEY,
  rescheduleWithoutAnswerSummary,
  selectRescheduleWithoutAnswer,
} from "@/lib/reschedule-follow-up";

type Props = {
  doctorId: string;
  doctorSlug: string | null;
  firstName: string | null;
  appointments: DashboardAppointmentRow[];
  workingHours: AgendaWorkingHours | null;
  clinics: AgendaClinic[];
  todayWindow: TodayWorkingWindow | null;
  pausedNotices: PausedClinicNotice[];
  /** Her pro access has ended: the manual booking window says so instead of the form. */
  accessEnded?: boolean;
  /** Patients' cancel window, for the short-notice warning when she cancels a visit. */
  patientCancelNoticeHours: number;
};

type ExitKind = "accepted" | "declined";

/** How long a handled request shows its result before it leaves the list. */
const EXIT_RESULT_MS = 700;
const EXIT_COLLAPSE_MS = 350;

function useNow(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function reviewPath(id: string, intent?: "suggest"): string {
  return reviewPathFromDashboard(id, intent);
}

/** Stagger list entrances without making long lists slow. */
function staggerStyle(index: number): React.CSSProperties {
  return { animationDelay: `${Math.min(index, 8) * 55}ms` };
}

export function DoctorDashboard({
  doctorId,
  doctorSlug,
  firstName,
  appointments,
  workingHours,
  clinics,
  todayWindow,
  pausedNotices,
  accessEnded = false,
  patientCancelNoticeHours,
}: Props) {
  const router = useRouter();
  const nowMs = useNow();
  const [rows, setRows] = React.useState(appointments);
  const [exiting, setExiting] = React.useState<Record<string, ExitKind>>({});
  const [manualOpen, setManualOpen] = React.useState(false);
  const [declineTarget, setDeclineTarget] = React.useState<DashboardAppointmentRow | null>(null);
  // Today's visit whose details are open, like on the agenda (user, 2026-10-09).
  const [openVisitId, setOpenVisitId] = React.useState<string | null>(null);
  const openVisitRow = openVisitId ? rows.find((row) => row.id === openVisitId) ?? null : null;

  React.useEffect(() => {
    setRows(appointments);
  }, [appointments]);

  const clinicTag = React.useCallback(
    (appointmentClinicId: string | null | undefined) => dashboardClinicTag(appointmentClinicId, clinics),
    [clinics],
  );

  const pending = selectPendingRequests(rows, nowMs);
  const shownPendingIds = new Set(pending.filter((row) => !exiting[row.id]).map((row) => row.id));
  const waitingCount = shownPendingIds.size;
  // Pending ids of the last server render; a new array tells the bar its refresh landed.
  const serverPendingIds = React.useMemo(
    () => selectPendingRequests(appointments, Date.now()).map((row) => row.id),
    [appointments],
  );
  const newRequests = useNewRequests({ doctorId, shownIds: shownPendingIds, serverPendingIds });
  const awaiting = selectAwaitingPatient(rows, nowMs);
  // "Close" hides a lapsed proposal on this device only (user, 2026-10-04).
  const noNewTimeClose = useDeviceDismissals(NO_NEW_TIME_DISMISSED_KEY);
  const noNewTime = selectRescheduleWithoutAnswer(rows, nowMs, noNewTimeClose.dismissed);
  const noNewTimeAllClosing = noNewTime.length > 0 && noNewTime.every((row) => noNewTimeClose.closing.has(row.id));
  // Requests nobody answered in time, last 7 days, so she can still call (user, 2026-10-08).
  const missedClose = useDeviceDismissals(MISSED_REQUESTS_DISMISSED_KEY);
  const missed = selectMissedRequests(rows, nowMs, missedClose.dismissed);
  const missedAllClosing = missed.length > 0 && missed.every((row) => missedClose.closing.has(row.id));
  // The 3 most recent first; the rest behind "Show N more" (user, 2026-10-08).
  const [showAllMissed, setShowAllMissed] = React.useState(false);
  const missedSplit = splitMonthDayItems(missed, MISSED_REQUESTS_SHOWN);
  const missedShown = showAllMissed ? missed : missedSplit.visible;

  // The badge counts the ones behind the bar too.
  const badgeCount = waitingCount + newRequests.count;
  React.useEffect(() => {
    emitPendingRequestsCount(badgeCount);
  }, [badgeCount]);
  const schedule = buildTodaySchedule(rows, {
    nowMs,
    startHour: todayWindow?.startHour,
    endHour: todayWindow?.endHour,
  });

  const greeting = dashboardGreeting(nowMs);
  const dateLabel = formatInTimeZone(new Date(nowMs), CY_TZ, "EEEE, d MMMM");

  function confirmDuration(row: DashboardAppointmentRow): number {
    if (isAllowedProfessionalDuration(Number(row.duration_minutes))) {
      return Number(row.duration_minutes);
    }
    const clinicId = clinicIdForAppointment(row.clinic_id, clinics);
    const slot =
      clinics.find((clinic) => clinic.id === clinicId)?.hours.slotDurationMinutes ??
      workingHours?.slotDurationMinutes;
    return isAllowedProfessionalDuration(Number(slot)) ? Number(slot) : 30;
  }

  /** Show the result on the row, let it slide out, then apply the change. */
  function finishRequest(row: DashboardAppointmentRow, kind: ExitKind) {
    setExiting((prev) => ({ ...prev, [row.id]: kind }));
    window.setTimeout(() => {
      setRows((prev) =>
        kind === "accepted"
          ? prev.map((r) =>
              r.id === row.id ? { ...r, status: "CONFIRMED", duration_minutes: confirmDuration(row) } : r,
            )
          : prev.filter((r) => r.id !== row.id),
      );
      setExiting((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      router.refresh();
    }, EXIT_RESULT_MS + EXIT_COLLAPSE_MS);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4 motion-safe:animate-fade-up">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          title={MANUAL_BOOKING_HINT}
          className="group inline-flex h-11 items-center gap-2 rounded-xl border border-clinical-400/40 bg-clinical-500/10 px-4 text-sm font-semibold text-clinical-100 transition hover:-translate-y-0.5 hover:border-clinical-400/70 hover:bg-clinical-500/20 hover:shadow-lg hover:shadow-clinical-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70 active:translate-y-0"
        >
          <CalendarPlus className="h-4 w-4 text-clinical-200 transition group-hover:scale-110" aria-hidden />
          {MANUAL_BOOKING_LABEL}
        </button>
      </header>

      <BookingsPausedNotice notices={pausedNotices} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
        <section
          id={DASHBOARD_NEEDS_ANSWER_ID}
          aria-labelledby="dashboard-pending-heading"
          data-new-requests-live={newRequests.live ? "1" : "0"}
          className="min-w-0 scroll-mt-24"
        >
          <div className="flex h-7 items-center gap-2.5">
            <h2 id="dashboard-pending-heading" className="text-xl font-semibold tracking-tight text-slate-50">
              Needs your answer
            </h2>
            {waitingCount > 0 ? (
              <span
                key={waitingCount}
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-clinical-500 px-2 text-xs font-bold text-ink-900 motion-safe:animate-pop"
              >
                {waitingCount}
              </span>
            ) : null}
          </div>

          {newRequests.count > 0 ? (
            <NewRequestsBar count={newRequests.count} onShow={newRequests.show} />
          ) : null}

          <div className="mt-3 overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/70 shadow-xl shadow-black/20">
            {pending.length === 0 && noNewTime.length === 0 && missed.length === 0 ? (
              <AllCaughtUp />
            ) : pending.length === 0 ? null : (
              <ul className="divide-y divide-slate-800/80">
                {pending.map((row, index) => (
                  <PendingRequestItem
                    key={row.id}
                    index={index}
                    row={row}
                    nowMs={nowMs}
                    clinicTag={clinicTag(row.clinic_id)}
                    durationMinutes={confirmDuration(row)}
                    exit={exiting[row.id] ?? null}
                    highlighted={newRequests.highlightedIds.has(row.id)}
                    onAccepted={() => finishRequest(row, "accepted")}
                    onDecline={() => setDeclineTarget(row)}
                  />
                ))}
              </ul>
            )}
            {noNewTime.length > 0 ? (
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                  noNewTimeAllClosing ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div
                    className={`px-5 py-4 text-sm text-slate-300 ${pending.length > 0 ? "border-t border-slate-800" : ""}`}
                    data-testid="dashboard-no-new-time"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
                      No new time chosen
                    </p>
                    <ul className="mt-2">
                      {noNewTime.map((row, index) => (
                        <RescheduleNoAnswerItem
                          key={row.id}
                          row={row}
                          first={index === 0}
                          closing={noNewTimeClose.closing.has(row.id)}
                          clinicTag={clinicTag(row.clinic_id)}
                          onClose={() => noNewTimeClose.close(row.id)}
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
            {missed.length > 0 ? (
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                  missedAllClosing ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div
                    className={`px-5 py-4 text-sm text-slate-300 ${
                      pending.length > 0 || noNewTime.length > 0 ? "border-t border-slate-800" : ""
                    }`}
                    data-testid="dashboard-missed-requests"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-300/90">Missed requests</p>
                    <ul className="mt-2">
                      {missedShown.map((row, index) => (
                        <MissedRequestItem
                          key={row.id}
                          row={row}
                          first={index === 0}
                          closing={missedClose.closing.has(row.id)}
                          clinicTag={clinicTag(row.clinic_id)}
                          onClose={() => missedClose.close(row.id)}
                        />
                      ))}
                    </ul>
                    {missedSplit.hiddenCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowAllMissed((v) => !v)}
                        aria-expanded={showAllMissed}
                        data-testid="dashboard-missed-requests-more"
                        className="mt-2.5 inline-flex items-center gap-1 text-sm font-semibold text-clinical-300 transition hover:text-clinical-200"
                      >
                        {showAllMissed ? "Show less" : `Show ${missedSplit.hiddenCount} more`}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${showAllMissed ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            {awaiting.length > 0 ? (
              <div className="border-t border-slate-800 px-5 py-3.5 text-sm text-slate-400">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Waiting for the patient
                </p>
                <ul className="mt-2 space-y-1.5">
                  {awaiting.map((row) => (
                    <AwaitingPatientItem key={row.id} row={row} clinicTag={clinicTag(row.clinic_id)} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <TodayTimeline
          items={schedule.items}
          todayWindow={todayWindow}
          nowMs={nowMs}
          clinicTag={clinicTag}
          onOpenVisit={setOpenVisitId}
        />
      </div>

      {openVisitRow ? (
        <VisitDetailsDialog
          key={openVisitRow.id}
          visit={visitDetailsFromRow(
            {
              ...openVisitRow,
              professional_id: openVisitRow.professional_id ?? doctorId,
              patient_name: openVisitRow.patient_name ?? "Patient",
              patient_phone: openVisitRow.patient_phone ?? "",
            },
            nowMs,
          )}
          clinicName={clinicTag(openVisitRow.clinic_id)?.name ?? null}
          clinicSwatchClass={clinicTag(openVisitRow.clinic_id)?.swatchClass ?? null}
          previousVisitClinicName={(clinicId) => clinicTag(clinicId ?? null)?.name ?? null}
          patientCancelNoticeHours={patientCancelNoticeHours}
          agendaHref={agendaHighlightHref(
            formatInTimeZone(new Date(openVisitRow.appointment_datetime), CY_TZ, "yyyy-MM-dd"),
            openVisitRow.id,
          )}
          onClose={() => setOpenVisitId(null)}
          onUpdated={(id, patch) =>
            setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
          }
          onRemoved={(id) => {
            setOpenVisitId(null);
            setRows((prev) => prev.filter((row) => row.id !== id));
            router.refresh();
          }}
        />
      ) : null}

      {declineTarget ? (
        <DeclineRequestDialog
          row={declineTarget}
          onClose={() => setDeclineTarget(null)}
          onDeclined={() => {
            finishRequest(declineTarget, "declined");
            setDeclineTarget(null);
          }}
        />
      ) : null}

      <ManualBookingFlow
        open={manualOpen}
        doctorId={doctorId}
        doctorSlug={doctorSlug}
        appointments={rows}
        workingHours={workingHours}
        clinics={clinics}
        preferredClinicId={clinics[0]?.id ?? null}
        accessEnded={accessEnded}
        onClose={() => setManualOpen(false)}
        onBooked={() => router.refresh()}
      />

      <ScrollFade />
    </div>
  );
}

/**
 * Soft fade at the bottom of the viewport while more of the page sits below,
 * so the last visible card does not look cut off. Sits above the phone tab bar.
 */
function ScrollFade() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    function update() {
      const root = document.documentElement;
      setVisible(root.scrollHeight - (window.scrollY + window.innerHeight) > 24);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden
      data-testid="dashboard-scroll-fade"
      data-visible={visible ? "true" : "false"}
      className={`pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-40 h-24 bg-gradient-to-t from-ink-900 via-ink-900/70 to-transparent transition-opacity duration-300 lg:bottom-0 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

/**
 * The patient let the proposed times expire: nothing is booked and the times are free again.
 * Nobody was emailed; she can only close it (no re-suggest, user 2026-10-04).
 */
function RescheduleNoAnswerItem({
  row,
  first,
  closing,
  clinicTag,
  onClose,
}: {
  row: DashboardAppointmentRow;
  first: boolean;
  /** Fading out after Close: it shrinks a touch and the rows below slide up (user, 2026-10-08). */
  closing: boolean;
  clinicTag: DashboardClinicTag | null;
  onClose: () => void;
}) {
  const summary = rescheduleWithoutAnswerSummary(row);

  return (
    <li
      data-testid="dashboard-no-new-time-item"
      data-closing={closing ? "true" : undefined}
      className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
        closing ? "pointer-events-none grid-rows-[0fr] scale-[0.98] opacity-0" : "grid-rows-[1fr]"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={first ? "" : "pt-3"}>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] px-3.5 py-3">
            <p className="leading-snug">
              {clinicTag ? <ClinicTag tag={clinicTag} className="mr-1.5 align-[1px]" /> : null}
              <span className="font-semibold text-slate-50">{row.patient_name}</span> didn&apos;t pick any of the
              times you suggested instead of{" "}
              <span className="font-medium text-slate-100">{summary.originalLabel}</span>. Nothing is booked.
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {summary.expiredLabel ? `Offer expired ${summary.expiredLabel} · ` : ""}The times are free again.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={closing}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-600/70 px-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/70 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/** A request nobody answered before its time: the patient was told; she can still call them. */
function MissedRequestItem({
  row,
  first,
  closing,
  clinicTag,
  onClose,
}: {
  row: DashboardAppointmentRow;
  first: boolean;
  closing: boolean;
  clinicTag: DashboardClinicTag | null;
  onClose: () => void;
}) {
  const summary = missedRequestSummary(row);

  return (
    <li
      data-testid="dashboard-missed-request"
      className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-safe:animate-fade-up motion-reduce:transition-none ${
        closing ? "pointer-events-none grid-rows-[0fr] scale-[0.98] opacity-0" : "grid-rows-[1fr]"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={first ? "" : "pt-3"}>
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] px-3.5 py-3">
            <p className="leading-snug">
              {clinicTag ? <ClinicTag tag={clinicTag} className="mr-1.5 align-[1px]" /> : null}
              <span className="font-semibold text-slate-50">{row.patient_name}</span> asked for{" "}
              <span className="font-medium text-slate-100">{summary.requestedLabel}</span> and got no answer in
              time.
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              We let them know and the time is free again. A call can still win them back.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {summary.call ? (
                <a
                  href={summary.call.href}
                  data-testid="dashboard-missed-request-call"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-clinical-400/40 bg-clinical-500/10 px-3 text-sm font-semibold text-clinical-100 transition hover:bg-clinical-500/20"
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  Call {summary.call.label}
                </a>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                disabled={closing}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-600/70 px-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/70 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/** Clinic name with its agenda colour, so clinics are told apart at a glance. */
function ClinicTag({ tag, className = "" }: { tag: DashboardClinicTag; className?: string }) {
  return (
    <span
      data-testid="dashboard-clinic-tag"
      className={`inline-flex max-w-[12rem] items-center gap-1.5 rounded-md border border-slate-700/80 bg-slate-800/70 px-1.5 py-0.5 text-[11px] font-semibold text-slate-200 ${className}`}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${tag.swatchClass}`} aria-hidden />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

/** A request where the doctor suggested times; "View" unfolds them in place. */
function AwaitingPatientItem({
  row,
  clinicTag,
}: {
  row: DashboardAppointmentRow;
  clinicTag: DashboardClinicTag | null;
}) {
  const [open, setOpen] = React.useState(false);
  const summary = awaitingPatientSummary(row);
  const panelId = `awaiting-${row.id}`;

  return (
    <li data-testid="dashboard-awaiting-patient">
      <div className="flex flex-wrap items-center gap-x-2">
        {clinicTag ? <ClinicTag tag={clinicTag} /> : null}
        <span className="font-semibold text-slate-100">{row.patient_name}</span>
        <span>You suggested other times.</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 font-medium text-clinical-300 transition hover:text-clinical-200"
        >
          {open ? "Hide" : "View"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5">
            {summary.slotLabels.length > 0 ? (
              <ul data-testid="dashboard-awaiting-slots" className="flex flex-wrap gap-1.5">
                {summary.slotLabels.map((label) => (
                  <li
                    key={label}
                    className="rounded-full border border-clinical-400/30 bg-clinical-500/10 px-2.5 py-1 text-xs font-medium tabular-nums text-clinical-100"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              {summary.expiresLabel ? (
                <span className="text-amber-200/90">Expires {summary.expiresLabel}</span>
              ) : (
                <span />
              )}
              <Link
                href={summary.agendaHref}
                tabIndex={open ? undefined : -1}
                className="font-semibold text-clinical-300 hover:text-clinical-200"
              >
                See in agenda
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/** Rows brought in by "Show": the agenda's spotlight, once. */
const NEW_REQUEST_SPOTLIGHT_CLASS =
  "motion-safe:animate-spotlight motion-reduce:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.75)]";

/**
 * "1 new request · Show": new requests wait here instead of sliding into the list,
 * so nothing moves under her finger (user, 2026-10-09). Sticks under the header
 * while she scrolls the list.
 */
function NewRequestsBar({ count, onShow }: { count: number; onShow: () => void }) {
  return (
    <div className="sticky top-20 z-10 mt-3 flex justify-center">
      <div
        role="status"
        data-testid="dashboard-new-requests-bar"
        className="inline-flex items-center gap-2 rounded-full border border-clinical-400/50 bg-slate-900/95 py-1 pl-4 pr-1 text-sm shadow-lg shadow-black/30 backdrop-blur motion-safe:animate-fade-up"
      >
        <span className="h-2 w-2 rounded-full bg-clinical-400 motion-safe:animate-pulse" aria-hidden />
        <span key={count} className="font-semibold text-clinical-100 motion-safe:animate-pop">
          {newRequestsLabel(count)}
        </span>
        <span className="text-slate-500" aria-hidden>
          ·
        </span>
        <button
          type="button"
          onClick={onShow}
          className="rounded-full px-3 py-1 font-semibold text-clinical-200 transition hover:bg-clinical-500/20 hover:text-clinical-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70"
        >
          Show
        </button>
      </div>
    </div>
  );
}

function AllCaughtUp() {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-clinical-500/15 text-clinical-300 ring-1 ring-clinical-400/30 motion-safe:animate-check-in">
        <CheckCircle2 className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 text-base font-semibold text-slate-50 motion-safe:animate-fade-up">You&apos;re all caught up</p>
      <p className="mt-1 text-sm text-slate-400 motion-safe:animate-fade-up" style={staggerStyle(1)}>
        No requests waiting for you.
      </p>
    </div>
  );
}

/**
 * One line per paused clinic (user, 2026-10-03). The "x" hides a line for good, until that
 * clinic's pause changes; other devices don't matter.
 */
function BookingsPausedNotice({ notices }: { notices: PausedClinicNotice[] }) {
  const [closed, setClosed] = React.useState<Set<string>>(() => new Set());
  const visible = notices.filter((n) => !closed.has(n.linkId));
  if (visible.length === 0) return null;

  async function dismiss(linkId: string) {
    setClosed((prev) => new Set(prev).add(linkId));
    try {
      const res = await fetch(`/api/professional-clinics/${encodeURIComponent(linkId)}/dismiss-pause-notice`, {
        method: "POST",
        credentials: "include",
      });
      // 409: no longer paused, so nothing to show anyway.
      if (!res.ok && res.status !== 409) throw new Error(String(res.status));
    } catch {
      setClosed((prev) => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
      toast.error("Could not close it. Please try again.");
    }
  }

  return (
    <div className="space-y-2">
      {visible.map((n) => (
        <div
          key={n.linkId}
          role="status"
          data-testid="dashboard-paused-notice"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-amber-400/35 bg-amber-400/10 py-3 pl-4 pr-2 motion-safe:animate-fade-up"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <p className="text-sm font-semibold text-amber-200">Online bookings are paused at {n.clinicName}</p>
          <p className="flex-1 text-sm text-slate-300">Patients can&apos;t request new times there.</p>
          <Link href="/agenda/settings" className="text-sm font-semibold text-clinical-300 hover:text-clinical-200">
            Resume in settings
          </Link>
          <button
            type="button"
            onClick={() => void dismiss(n.linkId)}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label={`Close the paused notice for ${n.clinicName}`}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

function PendingRequestItem({
  index,
  row,
  nowMs,
  clinicTag,
  durationMinutes,
  exit,
  highlighted,
  onAccepted,
  onDecline,
}: {
  index: number;
  row: DashboardAppointmentRow;
  nowMs: number;
  clinicTag: DashboardClinicTag | null;
  durationMinutes: number;
  exit: ExitKind | null;
  /** Just brought in by "Show" on the new requests bar. */
  highlighted: boolean;
  onAccepted: () => void;
  onDecline: () => void;
}) {
  const router = useRouter();
  /** Which action is in flight; the whole row is locked meanwhile. */
  const [busy, setBusy] = React.useState<"accept" | "suggest" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [collapsing, setCollapsing] = React.useState(false);

  React.useEffect(() => {
    if (!exit) return;
    const id = window.setTimeout(() => setCollapsing(true), EXIT_RESULT_MS);
    return () => window.clearTimeout(id);
  }, [exit]);

  const start = new Date(row.appointment_datetime);
  const ago = requestedAgoLabel(row.created_at, nowMs);
  const details = [row.reason?.trim(), `${durationMinutes} min`].filter(Boolean).join(" · ");
  const locked = busy !== null || exit !== null;

  async function accept() {
    if (locked) return;
    setBusy("accept");
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(row.id)}/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          res.status === 409
            ? "This time overlaps another appointment. Open the request to change the length or suggest other times."
            : typeof data?.message === "string"
              ? data.message
              : "Could not confirm this appointment.";
        setError(message);
        toast.error(message);
        setBusy(null);
        return;
      }
      toast.success(`Confirmed. ${row.patient_name ?? "The patient"} has been notified.`);
      onAccepted();
    } catch {
      const message = "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
      setBusy(null);
    }
  }

  function openReview(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (locked) return;
    setBusy("suggest");
    router.push(reviewPath(row.id, "suggest"));
  }

  return (
    <li
      data-testid="dashboard-pending-request"
      data-highlighted={highlighted ? "true" : "false"}
      aria-busy={locked}
      className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-safe:animate-fade-up ${
        collapsing ? "grid-rows-[0fr] translate-x-6 opacity-0" : "grid-rows-[1fr]"
      }`}
      style={staggerStyle(index)}
    >
      <div className="min-h-0 overflow-hidden">
        <article
          className={`flex flex-col gap-2 px-5 py-4 transition-colors duration-300 sm:flex-row sm:gap-4 ${
            highlighted ? NEW_REQUEST_SPOTLIGHT_CLASS : ""
          } ${
            exit === "accepted"
              ? "bg-clinical-500/10"
              : exit === "declined"
                ? "bg-slate-800/60"
                : busy
                  ? "cursor-wait bg-slate-800/40"
                  : "hover:bg-slate-800/30"
          }`}
        >
          {/* Phone: date and time on one line above, so the buttons get the full width. */}
          <div className="flex items-baseline gap-2 sm:block sm:w-20 sm:shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-clinical-300">
              {formatInTimeZone(start, CY_TZ, "EEE d MMM")}
            </p>
            <p className="text-xl font-semibold tabular-nums text-slate-50 sm:mt-0.5">
              {formatInTimeZone(start, CY_TZ, "HH:mm")}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <div className={`transition-opacity ${busy ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[15px] font-semibold text-slate-50">{row.patient_name}</p>
                {clinicTag ? <ClinicTag tag={clinicTag} /> : null}
                {row.is_new_patient ? (
                  <span className="rounded-full bg-wellness-500/15 px-2 py-0.5 text-[11px] font-semibold text-wellness-200">
                    New patient
                  </span>
                ) : null}
              </div>
              {details ? <p className="mt-0.5 text-sm text-slate-400">{details}</p> : null}
              {ago ? <p className="mt-0.5 text-xs text-slate-500">Requested {ago}</p> : null}
            </div>
            {error ? (
              <p className="mt-1.5 text-xs text-amber-200">
                {error}{" "}
                <Link href={reviewPath(row.id)} className="font-semibold text-clinical-300 hover:text-clinical-200">
                  Open request
                </Link>
              </p>
            ) : null}

            {exit ? (
              <p
                className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold motion-safe:animate-check-in ${
                  exit === "accepted" ? "bg-clinical-500/20 text-clinical-100" : "bg-slate-700/60 text-slate-200"
                }`}
              >
                {exit === "accepted" ? <Check className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                {exit === "accepted" ? "Confirmed" : "Declined"}
              </p>
            ) : (
              /* Phone: Accept full width on top, the other two side by side. */
              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={accept}
                  disabled={locked}
                  className={`col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-clinical-500 px-5 text-sm font-semibold text-ink-900 shadow-md shadow-clinical-500/20 transition hover:-translate-y-0.5 hover:bg-clinical-400 hover:shadow-lg hover:shadow-clinical-500/30 active:translate-y-0 disabled:pointer-events-none sm:col-span-1 sm:h-10 ${
                    busy && busy !== "accept" ? "opacity-50" : ""
                  }`}
                >
                  {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {busy === "accept" ? "Accepting…" : "Accept"}
                </button>
                <Link
                  href={reviewPath(row.id, "suggest")}
                  onClick={openReview}
                  aria-disabled={locked}
                  tabIndex={locked ? -1 : undefined}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-clinical-400/40 px-2 py-1 text-center text-sm leading-tight font-medium text-clinical-100 transition hover:border-clinical-400/70 hover:bg-clinical-500/10 sm:min-h-10 sm:whitespace-nowrap sm:px-3.5 ${
                    locked ? "pointer-events-none" : ""
                  } ${busy && busy !== "suggest" ? "opacity-50" : ""}`}
                >
                  {busy === "suggest" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {busy === "suggest" ? "Opening…" : "Suggest other times"}
                </Link>
                <button
                  type="button"
                  onClick={onDecline}
                  disabled={locked}
                  className="h-11 rounded-xl border border-red-500/30 px-3 text-sm font-medium text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200 disabled:pointer-events-none disabled:opacity-50 sm:h-10"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        </article>
      </div>
    </li>
  );
}

type TimelineEntry =
  | { kind: "now" }
  | { kind: "visit"; item: TodayScheduleItem; isCurrent: boolean; isUpcomingNext: boolean };

function TodayTimeline({
  items,
  todayWindow,
  nowMs,
  clinicTag,
  onOpenVisit,
}: {
  items: TodayScheduleItem[];
  todayWindow: TodayWorkingWindow | null;
  nowMs: number;
  clinicTag: (locationId: string | null) => DashboardClinicTag | null;
  onOpenVisit: (appointmentId: string) => void;
}) {
  const { beforeIndex, currentId } = nowMarkerPosition(items, nowMs);
  // "Next" is the first visit that has not started, even while another is in progress.
  const nextId = items[beforeIndex]?.id ?? null;
  const entries: TimelineEntry[] = items.map((item) => ({
    kind: "visit",
    item,
    isCurrent: item.id === currentId,
    isUpcomingNext: item.id === nextId,
  }));
  if (!currentId) entries.splice(beforeIndex, 0, { kind: "now" });
  const nowLabel = formatInTimeZone(new Date(nowMs), CY_TZ, "HH:mm");

  return (
    // Heading outside the card, like "Needs your answer", so both columns line up.
    <section aria-labelledby="dashboard-today-heading" className="min-w-0 lg:sticky lg:top-20">
      <div className="flex h-7 items-center gap-3">
        <h2 id="dashboard-today-heading" className="text-xl font-semibold tracking-tight text-slate-50">
          Today
        </h2>
        <p className="min-w-0 flex-1 truncate text-sm text-slate-400">{todaySummaryLabel(items)}</p>
        <Link href="/agenda" className="shrink-0 text-sm font-medium text-clinical-300 hover:text-clinical-200">
          Open agenda
        </Link>
      </div>

      <div
        data-testid="dashboard-today-schedule"
        className="mt-3 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-xl shadow-black/20"
      >
        <ol className="relative">
          <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-px bg-gradient-to-b from-slate-700 via-slate-700 to-transparent" />
          {entries.map((entry, index) =>
            entry.kind === "now" ? (
              <NowMarker key="now" label={nowLabel} index={index} />
            ) : (
              <TimelineVisit
                key={entry.item.id}
                item={entry.item}
                isCurrent={entry.isCurrent}
                isNext={entry.isUpcomingNext}
                index={index}
                nowMs={nowMs}
                clinicTag={clinicTag(entry.item.clinicId)}
                onOpen={() => onOpenVisit(entry.item.id)}
              />
            ),
          )}
        </ol>
        {items.length === 0 ? (
          <p className="mt-2 pl-8 text-sm text-slate-400 motion-safe:animate-fade-up">
            {todayWindow ? "Nothing booked today yet." : "Nothing booked today. You're not working today."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PulsingDot({ tone, testId }: { tone: "now" | "next"; testId?: string }) {
  const color = tone === "now" ? "bg-rose-400" : "bg-clinical-400";
  return (
    <span data-testid={testId} className="relative flex h-4 w-4 items-center justify-center">
      <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${color}`} />
      <span
        className={`relative inline-flex h-3 w-3 rounded-full ring-4 ring-slate-900 ${color} ${
          tone === "now" ? "motion-safe:animate-blink" : ""
        }`}
      />
    </span>
  );
}

function NowMarker({ label, index }: { label: string; index: number }) {
  return (
    <li className="relative flex items-center gap-4 pb-5 motion-safe:animate-fade-up" style={staggerStyle(index)}>
      <PulsingDot tone="now" testId="dashboard-now-marker" />
      <span className="text-xs font-bold uppercase tracking-wide text-rose-300">Now · {label}</span>
      <span aria-hidden className="h-px flex-1 border-t border-dashed border-rose-400/40" />
    </li>
  );
}

function TimelineVisit({
  item,
  isCurrent,
  isNext,
  index,
  nowMs,
  clinicTag,
  onOpen,
}: {
  item: TodayScheduleItem;
  isCurrent: boolean;
  isNext: boolean;
  index: number;
  nowMs: number;
  clinicTag: DashboardClinicTag | null;
  /** Opens the visit's details window. */
  onOpen: () => void;
}) {
  const details = item.reason;
  const timeTone = isCurrent
    ? "text-rose-300"
    : isNext
      ? "text-clinical-300"
      : item.isPast
        ? "text-slate-500"
        : "text-slate-200";

  return (
    <li
      data-testid="dashboard-today-appointment"
      className={`relative flex gap-4 pb-5 last:pb-0 motion-safe:animate-fade-up ${item.isPast && !isCurrent ? "opacity-60" : ""}`}
      style={staggerStyle(index)}
    >
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {isCurrent ? (
          <PulsingDot tone="now" testId="dashboard-now-marker" />
        ) : isNext ? (
          <PulsingDot tone="next" />
        ) : (
          <span
            className={`h-3 w-3 rounded-full ring-4 ring-slate-900 ${
              item.isPast ? "bg-slate-600" : "border-2 border-clinical-400/70 bg-slate-900"
            }`}
          />
        )}
      </span>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Appointment ${item.patientName} at ${item.rangeLabel}`}
        className="group -mx-2 -my-1 min-w-0 flex-1 rounded-xl px-2 py-1 text-left text-slate-50 transition hover:bg-slate-800/50 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold tabular-nums ${timeTone}`}>{item.rangeLabel}</span>
          {isCurrent ? (
            <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[11px] font-bold text-rose-200">Now</span>
          ) : isNext ? (
            <span className="rounded-full bg-clinical-500/15 px-2 py-0.5 text-[11px] font-bold text-clinical-200">
              Next · {startsInLabel(item.startIso, nowMs)}
            </span>
          ) : null}
          {clinicTag ? <ClinicTag tag={clinicTag} /> : null}
        </div>
        <p className="mt-0.5 truncate text-[15px] font-semibold transition group-hover:translate-x-0.5">
          {item.patientName}
          {item.isNewPatient ? (
            <span className="ml-2 rounded-full bg-wellness-500/15 px-2 py-0.5 align-middle text-[11px] font-semibold text-wellness-200">
              New patient
            </span>
          ) : null}
        </p>
        {details ? <p className="truncate text-sm text-slate-400">{details}</p> : null}
      </button>
    </li>
  );
}
