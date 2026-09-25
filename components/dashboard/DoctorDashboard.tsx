"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { AlertTriangle, CalendarPlus } from "lucide-react";
import { ManualBookingFlow } from "@/components/agenda/ManualBookingFlow";
import { CY_TZ } from "@/lib/appointments";
import {
  clinicIdForAppointment,
  type AgendaClinic,
  type AgendaWorkingHours,
} from "@/lib/agenda-clinics";
import {
  buildTodaySchedule,
  dashboardGreeting,
  requestedAgoLabel,
  selectAwaitingPatient,
  selectPendingRequests,
  startsInLabel,
  todaySummaryLabel,
  type DashboardAppointmentRow,
  type TodayScheduleItem,
  type TodayWorkingWindow,
} from "@/lib/doctor-dashboard";
import { isAllowedProfessionalDuration } from "@/lib/professional-appointment-durations";

type Props = {
  doctorId: string;
  doctorSlug: string | null;
  firstName: string | null;
  appointments: DashboardAppointmentRow[];
  workingHours: AgendaWorkingHours | null;
  clinics: AgendaClinic[];
  todayWindow: TodayWorkingWindow | null;
  bookingsPaused: { all: boolean; clinicNames: string[] };
};

const REASON_MIN = 10;
/** Vertical scale of the Today schedule. */
const PX_PER_MINUTE = 1.4;
const MIN_BLOCK_PX = 32;

function useNow(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function reviewPath(id: string): string {
  return `/dashboard/appointments/${encodeURIComponent(id)}`;
}

export function DoctorDashboard({
  doctorId,
  doctorSlug,
  firstName,
  appointments,
  workingHours,
  clinics,
  todayWindow,
  bookingsPaused,
}: Props) {
  const router = useRouter();
  const nowMs = useNow();
  const [rows, setRows] = React.useState(appointments);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [declineTarget, setDeclineTarget] = React.useState<DashboardAppointmentRow | null>(null);

  React.useEffect(() => {
    setRows(appointments);
  }, [appointments]);

  const isMultiClinic = clinics.length > 1;
  const clinicName = React.useCallback(
    (locationId: string | null) => {
      if (!isMultiClinic) return null;
      const id = clinicIdForAppointment(locationId, clinics);
      return clinics.find((clinic) => clinic.id === id)?.name ?? null;
    },
    [clinics, isMultiClinic],
  );

  const pending = selectPendingRequests(rows, nowMs);
  const awaiting = selectAwaitingPatient(rows, nowMs);
  const schedule = buildTodaySchedule(rows, {
    nowMs,
    startHour: todayWindow?.startHour,
    endHour: todayWindow?.endHour,
  });

  const greeting = dashboardGreeting(nowMs);
  const dateLabel = formatInTimeZone(new Date(nowMs), CY_TZ, "EEEE, d MMMM");

  function updateRow(id: string, patch: Partial<DashboardAppointmentRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function confirmDuration(row: DashboardAppointmentRow): number {
    if (isAllowedProfessionalDuration(Number(row.duration_minutes))) {
      return Number(row.duration_minutes);
    }
    const clinicId = clinicIdForAppointment(row.location_id, clinics);
    const slot =
      clinics.find((clinic) => clinic.id === clinicId)?.hours.slotDurationMinutes ??
      workingHours?.slotDurationMinutes;
    return isAllowedProfessionalDuration(Number(slot)) ? Number(slot) : 30;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-clinical-400/40 bg-clinical-500/10 px-4 text-sm font-semibold text-clinical-100 transition hover:bg-clinical-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70"
        >
          <CalendarPlus className="h-4 w-4 text-clinical-200" aria-hidden />
          New booking
        </button>
      </header>

      <BookingsPausedNotice paused={bookingsPaused} />

      <section aria-labelledby="dashboard-pending-heading">
        <div className="flex items-center gap-2.5">
          <h2 id="dashboard-pending-heading" className="text-xl font-semibold tracking-tight text-slate-50">
            Needs your answer
          </h2>
          {pending.length > 0 ? (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-clinical-500 px-2 text-xs font-bold text-ink-900">
              {pending.length}
            </span>
          ) : null}
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/70">
          {pending.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No requests waiting for you.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {pending.map((row) => (
                <PendingRequestItem
                  key={row.id}
                  row={row}
                  nowMs={nowMs}
                  clinicName={clinicName(row.location_id)}
                  durationMinutes={confirmDuration(row)}
                  onAccepted={() => {
                    updateRow(row.id, { status: "CONFIRMED", duration_minutes: confirmDuration(row) });
                    router.refresh();
                  }}
                  onDecline={() => setDeclineTarget(row)}
                />
              ))}
            </ul>
          )}
          {awaiting.length > 0 ? (
            <div className="border-t border-slate-800 px-5 py-3.5 text-sm text-slate-400">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Waiting for the patient
              </p>
              <ul className="mt-2 space-y-1.5">
                {awaiting.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-x-2">
                    <span className="font-semibold text-slate-100">{row.patient_name}</span>
                    <span>You suggested other times.</span>
                    <Link href={reviewPath(row.id)} className="font-medium text-clinical-300 hover:text-clinical-200">
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <TodaySection
        schedule={schedule}
        todayWindow={todayWindow}
        nowMs={nowMs}
        dateKey={formatInTimeZone(new Date(nowMs), CY_TZ, "yyyy-MM-dd")}
        clinicName={clinicName}
      />

      {declineTarget ? (
        <DeclineRequestDialog
          row={declineTarget}
          onClose={() => setDeclineTarget(null)}
          onDeclined={() => {
            removeRow(declineTarget.id);
            setDeclineTarget(null);
            router.refresh();
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
        onClose={() => setManualOpen(false)}
        onBooked={() => router.refresh()}
      />
    </div>
  );
}

function BookingsPausedNotice({ paused }: { paused: Props["bookingsPaused"] }) {
  if (!paused.all && paused.clinicNames.length === 0) return null;
  const where =
    !paused.all && paused.clinicNames.length > 0 ? ` at ${paused.clinicNames.join(", ")}` : "";
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-amber-400/35 bg-amber-400/10 px-4 py-3"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
      <p className="text-sm font-semibold text-amber-200">Online bookings are paused{where}</p>
      <p className="flex-1 text-sm text-slate-300">Patients can&apos;t request new times.</p>
      <Link href="/agenda/settings" className="text-sm font-semibold text-clinical-300 hover:text-clinical-200">
        Resume in settings
      </Link>
    </div>
  );
}

function PendingRequestItem({
  row,
  nowMs,
  clinicName,
  durationMinutes,
  onAccepted,
  onDecline,
}: {
  row: DashboardAppointmentRow;
  nowMs: number;
  clinicName: string | null;
  durationMinutes: number;
  onAccepted: () => void;
  onDecline: () => void;
}) {
  const [accepting, setAccepting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const start = new Date(row.appointment_datetime);
  const ago = requestedAgoLabel(row.created_at, nowMs);
  const details = [row.reason?.trim(), clinicName, `${durationMinutes} min`].filter(Boolean).join(" · ");

  async function accept() {
    if (accepting) return;
    setAccepting(true);
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
        setAccepting(false);
        return;
      }
      toast.success(`Confirmed. ${row.patient_name ?? "The patient"} has been notified.`);
      onAccepted();
    } catch {
      const message = "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
      setAccepting(false);
    }
  }

  return (
    <li
      data-testid="dashboard-pending-request"
      className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:gap-5"
    >
      <div className="flex items-baseline gap-3 sm:block sm:w-28 sm:shrink-0">
        <p className="text-sm font-semibold text-clinical-300">
          {formatInTimeZone(start, CY_TZ, "EEE d MMM")}
        </p>
        <p className="text-xl font-semibold tabular-nums text-slate-50 sm:mt-0.5">
          {formatInTimeZone(start, CY_TZ, "HH:mm")}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[15px] font-semibold text-slate-50">{row.patient_name}</p>
          {row.is_new_patient ? (
            <span className="rounded-full bg-wellness-500/15 px-2 py-0.5 text-[11px] font-semibold text-wellness-200">
              New patient
            </span>
          ) : null}
        </div>
        {details ? <p className="mt-0.5 text-sm text-slate-400">{details}</p> : null}
        {ago ? <p className="mt-0.5 text-xs text-slate-500">Requested {ago}</p> : null}
        {error ? (
          <p className="mt-1.5 text-xs text-amber-200">
            {error}{" "}
            <Link href={reviewPath(row.id)} className="font-semibold text-clinical-300 hover:text-clinical-200">
              Open request
            </Link>
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDecline}
          disabled={accepting}
          className="h-10 rounded-xl px-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-60"
        >
          Decline
        </button>
        <Link
          href={reviewPath(row.id)}
          className="inline-flex h-10 items-center rounded-xl border border-clinical-400/40 px-3.5 text-sm font-medium text-clinical-100 transition hover:bg-clinical-500/10"
        >
          Suggest other times
        </Link>
        <button
          type="button"
          onClick={accept}
          disabled={accepting}
          className="h-10 rounded-xl bg-clinical-500 px-5 text-sm font-semibold text-ink-900 transition hover:bg-clinical-400 disabled:cursor-wait disabled:opacity-70"
        >
          {accepting ? "Accepting…" : "Accept"}
        </button>
      </div>
    </li>
  );
}

function TodaySection({
  schedule,
  todayWindow,
  nowMs,
  dateKey,
  clinicName,
}: {
  schedule: ReturnType<typeof buildTodaySchedule>;
  todayWindow: TodayWorkingWindow | null;
  nowMs: number;
  dateKey: string;
  clinicName: (locationId: string | null) => string | null;
}) {
  const { items, startHour, endHour, nowMinute } = schedule;
  const gridStart = startHour * 60;
  const height = (endHour - startHour) * 60 * PX_PER_MINUTE;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const showGrid = items.length > 0 || todayWindow !== null;
  const top = (minute: number) => (minute - gridStart) * PX_PER_MINUTE;

  return (
    <section
      aria-labelledby="dashboard-today-heading"
      className="rounded-3xl border border-clinical-500/40 bg-slate-900/70 px-4 pb-5 pt-4 sm:px-6"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="dashboard-today-heading" className="text-xl font-semibold tracking-tight text-slate-50">
          Today
        </h2>
        <p className="text-sm text-slate-400">{todaySummaryLabel(items)}</p>
        <Link
          href="/agenda"
          className="ml-auto text-sm font-medium text-clinical-300 hover:text-clinical-200"
        >
          Open agenda
        </Link>
      </div>

      <div data-testid="dashboard-today-schedule" className="mt-4">
        {!showGrid ? (
          <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
            Nothing booked today, and no working hours set for today.
          </p>
        ) : (
          <div className="relative" style={{ height }}>
            {hours.map((hour) => (
              <div key={hour} className="absolute inset-x-0" style={{ top: top(hour * 60) }} aria-hidden>
                <div className="ml-14 border-t border-slate-800" />
                <span className="absolute left-0 -translate-y-1/2 text-xs font-semibold tabular-nums text-slate-400">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}

            {todayWindow?.breakStart != null &&
            todayWindow.breakEnd != null &&
            todayWindow.breakEnd > todayWindow.breakStart ? (
              <div
                className="absolute left-14 right-0 flex items-center justify-center rounded-lg bg-[repeating-linear-gradient(135deg,rgba(30,41,59,0.6)_0_8px,transparent_8px_16px)]"
                style={{
                  top: top(todayWindow.breakStart),
                  height: (todayWindow.breakEnd - todayWindow.breakStart) * PX_PER_MINUTE,
                }}
              >
                <span className="text-xs font-medium text-slate-500">Break</span>
              </div>
            ) : null}

            {items.map((item) => (
              <TodayBlock
                key={item.id}
                item={item}
                nowMs={nowMs}
                clinicName={clinicName(item.locationId)}
                dateKey={dateKey}
                style={{
                  top: top(item.startMinute) + 1,
                  height: Math.max((item.endMinute - item.startMinute) * PX_PER_MINUTE - 3, MIN_BLOCK_PX),
                }}
              />
            ))}

            {nowMinute !== null ? (
              <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: top(nowMinute) }} aria-hidden>
                <div className="ml-12 border-t-2 border-red-400" />
                <div className="absolute left-[2.6rem] top-[-5px] h-2.5 w-2.5 rounded-full bg-red-400" />
              </div>
            ) : null}

            {items.length === 0 ? (
              <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 pl-14 text-center text-sm text-slate-400">
                No appointments today.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function TodayBlock({
  item,
  nowMs,
  clinicName,
  dateKey,
  style,
}: {
  item: TodayScheduleItem;
  nowMs: number;
  clinicName: string | null;
  dateKey: string;
  style: React.CSSProperties;
}) {
  const tone = item.isPast
    ? "border-slate-600 bg-slate-800 text-slate-300"
    : "border-clinical-500/70 bg-clinical-500/35 text-white shadow-md shadow-clinical-500/20";
  const ring = item.isNext ? " ring-2 ring-clinical-300" : "";

  return (
    <div
      data-testid="dashboard-today-appointment"
      className={`absolute left-14 right-0 flex items-center gap-2 overflow-hidden rounded-lg border px-3${ring} ${tone}`}
      style={style}
    >
      <Link
        href={`/agenda?date=${dateKey}`}
        aria-label={`Appointment ${item.patientName} at ${item.rangeLabel}`}
        className={`flex min-w-0 flex-1 items-center gap-2.5 text-sm no-underline ${
          item.isPast ? "text-slate-300 hover:text-slate-100" : "text-white hover:text-white"
        }`}
      >
        <span className="shrink-0 font-bold tabular-nums">{item.rangeLabel}</span>
        <span className="truncate font-semibold">
          {item.patientName}
        </span>
        {item.reason ? <span className="hidden truncate text-xs opacity-80 sm:inline">{item.reason}</span> : null}
        {item.isNewPatient ? (
          <span className="hidden shrink-0 rounded-full bg-ink-900/40 px-2 py-0.5 text-[11px] font-semibold sm:inline">
            New patient
          </span>
        ) : null}
      </Link>
      {item.isNext ? (
        <span className="shrink-0 rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-bold text-clinical-200">
          {startsInLabel(item.startIso, nowMs) === "Now" ? "Now" : `Next · ${startsInLabel(item.startIso, nowMs)}`}
        </span>
      ) : null}
      {clinicName ? <span className="hidden shrink-0 text-xs opacity-75 md:inline">{clinicName}</span> : null}
    </div>
  );
}

function DeclineRequestDialog({
  row,
  onClose,
  onDeclined,
}: {
  row: DashboardAppointmentRow;
  onClose: () => void;
  onDeclined: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    textareaRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (submitting || reason.trim().length < REASON_MIN) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(row.id)}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = typeof data?.message === "string" ? data.message : "We could not decline this request.";
        setError(message);
        toast.error(message);
        setSubmitting(false);
        return;
      }
      toast.success("Request declined. The patient has been notified.");
      onDeclined();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const start = new Date(row.appointment_datetime);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm"
        aria-label="Close"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="decline-request-title"
        className="relative z-10 w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <h2 id="decline-request-title" className="text-lg font-semibold text-slate-50">
          Decline this request?
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {row.patient_name} · {formatInTimeZone(start, CY_TZ, "EEE d MMM, HH:mm")}
        </p>
        <p className="mt-3 text-sm text-slate-300">
          The patient will receive an email with your message and a link to book again on your profile.
        </p>
        <label htmlFor="decline-request-reason" className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-400">
          Reason for the patient (required)
        </label>
        <textarea
          id="decline-request-reason"
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          disabled={submitting}
          placeholder="e.g. I am away that day. Please book another time on my profile."
          className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none focus:ring-1 focus:ring-clinical-500/40"
        />
        <p className="mt-1 text-xs text-slate-500">At least {REASON_MIN} characters.</p>
        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-slate-700 bg-slate-800 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || reason.trim().length < REASON_MIN}
            className="h-11 flex-1 rounded-xl border border-red-500/40 bg-red-500/10 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Declining…" : "Decline & notify"}
          </button>
        </div>
      </div>
    </div>
  );
}
