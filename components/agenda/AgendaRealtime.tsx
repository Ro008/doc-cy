"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  format,
  isSameDay,
  isValid,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { enGB } from "date-fns/locale";
import { formatInTimeZone, utcToZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Loader2, Trash2, X } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { useTranslations } from "next-intl";
import {
  PROFESSIONAL_DURATION_OPTIONS,
  formatProfessionalDurationLabel,
  type ProfessionalDurationOption,
} from "@/lib/professional-appointment-durations";
import {
  appointmentDateKeyCyprus,
  appointmentMinutesFromAgendaStart,
  appointmentTimeLabelCyprus,
  appointmentToCyprusDate,
  CY_TZ,
  isRescheduleProposalLive,
  isVisitSlotEnded,
} from "@/lib/appointments";
import { patientVisitReasonFromAppointmentRow } from "@/lib/agenda-visit-reason";
import type { WeeklySchedule } from "@/lib/doctor-settings";
import { ManualBookingFlow } from "@/components/agenda/ManualBookingFlow";
import { emitNavigationStart } from "@/lib/doccy-navigation";
import {
  APPOINTMENT_ATTENDANCE_NO_SHOW,
  isNoShowAttendance,
} from "@/lib/appointment-attendance";

type AgendaAppointmentRow = {
  id: string;
  doctor_id: string;
  patient_name: string;
  patient_phone: string;
  reason?: string | null;
  appointment_datetime: string;
  status?: string | null;
  duration_minutes?: number | null;
  proposed_slots?: unknown;
  proposal_expires_at?: string | null;
  attendance?: string | null;
};

function parseProposedSlotIsoList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function closestAllowedDuration(maybeMinutes: number): ProfessionalDurationOption {
  const allowed = [...PROFESSIONAL_DURATION_OPTIONS];
  let best = allowed[0]!;
  let bestDist = Math.abs(maybeMinutes - best);
  for (const opt of allowed) {
    const d = Math.abs(maybeMinutes - opt);
    if (d < bestDist) {
      best = opt;
      bestDist = d;
    }
  }
  return best;
}

/** One grid row per visible block (counter-offer holds expand to one row per proposed start while the proposal is live). */
function expandAgendaAppointmentsForGrid(
  appointments: AgendaAppointmentRow[],
  nowMs: number,
): Array<
  AgendaAppointmentRow & {
    rowKey: string;
    gridStartIso: string;
    isCounterOfferHold: boolean;
  }
> {
  const out: Array<
    AgendaAppointmentRow & {
      rowKey: string;
      gridStartIso: string;
      isCounterOfferHold: boolean;
    }
  > = [];
  for (const a of appointments) {
    const su = String(a.status ?? "").toUpperCase();
    const expRaw = a.proposal_expires_at;
    const expMs = expRaw ? new Date(expRaw).getTime() : NaN;
    const proposalLive =
      su === "NEEDS_RESCHEDULE" && Number.isFinite(expMs) && expMs > nowMs;
    const slots = proposalLive
      ? parseProposedSlotIsoList(a.proposed_slots)
      : [];

    if (slots.length > 0) {
      slots.forEach((iso, i) => {
        out.push({
          ...a,
          rowKey: `${a.id}-proposal-${i}`,
          gridStartIso: iso,
          isCounterOfferHold: true,
        });
      });
    } else {
      out.push({
        ...a,
        rowKey: a.id,
        gridStartIso: a.appointment_datetime,
        isCounterOfferHold: false,
      });
    }
  }
  return out;
}

function agendaRowFromSupabasePayload(
  raw: Record<string, unknown>,
): AgendaAppointmentRow | null {
  if (typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    doctor_id: String(raw.doctor_id ?? ""),
    patient_name: String(raw.patient_name ?? ""),
    patient_phone: String(raw.patient_phone ?? ""),
    reason: patientVisitReasonFromAppointmentRow(raw),
    appointment_datetime: String(raw.appointment_datetime ?? ""),
    status: raw.status == null || raw.status === "" ? null : String(raw.status),
    duration_minutes:
      typeof raw.duration_minutes === "number" ? raw.duration_minutes : null,
    proposed_slots: raw.proposed_slots,
    proposal_expires_at:
      raw.proposal_expires_at == null || raw.proposal_expires_at === ""
        ? null
        : String(raw.proposal_expires_at),
    attendance:
      raw.attendance == null || raw.attendance === ""
        ? null
        : String(raw.attendance),
  };
}

function sortAgendaRowsByDatetime(rows: AgendaAppointmentRow[]): AgendaAppointmentRow[] {
  const copy = [...rows];
  copy.sort(
    (a, b) =>
      new Date(a.appointment_datetime).getTime() -
      new Date(b.appointment_datetime).getTime(),
  );
  return copy;
}

const START_HOUR = 8;
const END_HOUR = 20;
const HOUR_ROW_HEIGHT = 56;
type AgendaWorkingHours = {
  weeklySchedule: WeeklySchedule;
  breakStart: string | null;
  breakEnd: string | null;
  slotDurationMinutes: number;
};

function AgendaAppointmentCardInner({
  timeLabel,
  patientName,
  isPendingRequest,
  isRequested,
  isCounterOfferHold,
  isCompactCounterOffer,
}: {
  timeLabel: string;
  patientName: string;
  isPendingRequest: boolean;
  isRequested: boolean;
  isCounterOfferHold: boolean;
  isCompactCounterOffer: boolean;
}) {
  const t = useTranslations("DoctorAgenda");
  const nameColor = isPendingRequest ? "text-amber-100" : "text-clinical-100";
  const patientDisplay = patientName.trim() || "Patient";
  const topRightBadge = isRequested
    ? t("appointmentPendingBadge")
    : isCounterOfferHold
      ? t("counterOfferHoldBadge")
      : null;
  const cardTitle = `${patientDisplay} · ${timeLabel}`;

  if (isCounterOfferHold) {
    // Adapt layout by chip height:
    // - 30m slots: one compact row
    // - taller slots: two rows to maximize patient-name visibility
    if (isCompactCounterOffer) {
      return (
        <div
          className="relative min-h-0 min-w-0 text-left"
          title={cardTitle}
        >
          <p
            className={`flex min-h-0 min-w-0 items-center gap-0.5 truncate text-left text-[11px] font-semibold leading-tight ${nameColor}`}
          >
            <span className="shrink-0 tabular-nums text-[10px] font-semibold leading-none text-slate-300/95">
              {timeLabel}
            </span>
            <span className="shrink-0 opacity-50">·</span>
            <span className="min-w-0 flex-1 truncate" title={patientDisplay}>
              {patientDisplay}
            </span>
            {topRightBadge ? (
              <span
                className="ml-1 shrink-0 max-w-[3.35rem] truncate rounded bg-ink-900/55 px-1 py-0 text-[8px] font-medium leading-none text-amber-100/90 ring-1 ring-amber-400/20"
                title={topRightBadge}
              >
                {topRightBadge}
              </span>
            ) : null}
          </p>
        </div>
      );
    }

    return (
      <div
        className="relative min-h-0 min-w-0 text-left"
        title={cardTitle}
      >
        <div className={`flex min-w-0 items-center ${topRightBadge ? "pr-[2.55rem]" : ""}`}>
          <span className="shrink-0 tabular-nums text-[10px] font-semibold leading-none text-slate-300/95">
            {timeLabel}
          </span>
        </div>
        {topRightBadge ? (
          <span
            className="pointer-events-none absolute right-0 top-0 z-10 max-w-[46%] truncate rounded bg-ink-900/55 px-0.5 py-0 text-[8px] font-medium leading-none text-amber-100/90 ring-1 ring-amber-400/20 backdrop-blur-sm"
            title={topRightBadge}
          >
            {topRightBadge}
          </span>
        ) : null}
        <p className="mt-0.5 min-w-0 truncate text-left text-[11px] font-semibold leading-tight">
          <span className={`min-w-0 truncate ${nameColor}`} title={patientDisplay}>
            {patientDisplay}
          </span>
        </p>
      </div>
    );
  }

  return (
    <>
      {topRightBadge ? (
        <span
          className="pointer-events-none absolute right-0.5 top-0.5 z-10 max-w-[42%] truncate rounded bg-ink-900/50 px-0.5 py-0 text-[9px] font-medium leading-none text-amber-100/90 ring-1 ring-amber-400/20 backdrop-blur-sm"
          title={topRightBadge}
        >
          {topRightBadge}
        </span>
      ) : null}
      <p
        className={`flex min-h-0 min-w-0 items-center gap-0.5 truncate text-left text-xs font-semibold leading-tight ${nameColor} ${topRightBadge ? "pr-[2.15rem]" : ""}`}
      >
        <span className="shrink-0 tabular-nums">{timeLabel}</span>
        <span className="shrink-0 opacity-50">·</span>
        <span className="min-w-0 truncate" title={patientDisplay}>
          {patientDisplay}
        </span>
      </p>
    </>
  );
}

export function AgendaRealtime({
  doctorId,
  doctorSlug,
  initialAppointments,
  workingHours,
  initialDateKey,
  openManualBooking,
}: {
  doctorId: string | null;
  doctorSlug?: string | null;
  initialAppointments: AgendaAppointmentRow[];
  workingHours: AgendaWorkingHours | null;
  initialDateKey?: string | null;
  openManualBooking?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = React.useMemo(() => createClientComponentClient(), []);
  const [openingReview, setOpeningReview] = React.useState(false);
  const [appointments, setAppointments] =
    React.useState<AgendaAppointmentRow[]>(initialAppointments);
  const [toast, setToast] = React.useState(false);
  const [selected, setSelected] = React.useState<
    | (AgendaAppointmentRow & {
        rowKey: string;
        gridStartIso: string;
        isCounterOfferHold: boolean;
        dateKey: string;
        dateLabel: string;
        timeLabel: string;
        minutesFromStart: number;
        isPendingRequest: boolean;
        isRequested: boolean;
        showReviewLink: boolean;
        rowDurationMinutes: number;
        sortKeyMs: number;
      })
    | null
  >(null);
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const [cancelMode, setCancelMode] = React.useState<
    null | "confirmed" | "requested"
  >(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [rescheduleDuration, setRescheduleDuration] =
    React.useState<ProfessionalDurationOption>(30);
  const [loadingAlternatives, setLoadingAlternatives] = React.useState(false);
  const [sendingProposal, setSendingProposal] = React.useState(false);
  const [rescheduleReason, setRescheduleReason] = React.useState("");
  const [rescheduleError, setRescheduleError] = React.useState<string | null>(
    null,
  );
  const [previewSlots, setPreviewSlots] = React.useState<string[] | null>(null);
  const [markingAttendance, setMarkingAttendance] = React.useState(false);
  const [attendanceError, setAttendanceError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    setOpeningReview(false);
  }, [pathname]);

  React.useEffect(() => {
    setOpeningReview(false);
  }, [selected?.id]);

  const modalBusy = isCancelling || openingReview || markingAttendance;
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [mobileDayOffset, setMobileDayOffset] = React.useState(0);
  const [manualBookingOpen, setManualBookingOpen] = React.useState(false);

  React.useEffect(() => {
    if (!openManualBooking) return;
    setManualBookingOpen(true);
  }, [openManualBooking]);

  React.useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  const refreshAppointmentsFromServer = React.useCallback(async () => {
    if (!doctorId) return;
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, doctor_id, patient_name, patient_phone, reason, appointment_datetime, status, duration_minutes, proposed_slots, proposal_expires_at, attendance",
      )
      .eq("doctor_id", doctorId)
      .order("appointment_datetime", { ascending: true });

    if (error || !data) return;
    const mapped = (data as Record<string, unknown>[])
      .map(agendaRowFromSupabasePayload)
      .filter((x): x is AgendaAppointmentRow => x !== null);
    setAppointments(sortAgendaRowsByDatetime(mapped));
  }, [doctorId, supabase]);

  /** Re-expand grid when counter-offer deadlines pass (no full reload needed). */
  const [, bumpAgendaClock] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => bumpAgendaClock((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!doctorId) return;

    const channel = supabase
      .channel(`agenda-appointments-${doctorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `doctor_id=eq.${doctorId}`,
        },
        (payload) => {
          const raw = payload.new as Record<string, unknown> | null;
          if (!raw) return;
          const next = agendaRowFromSupabasePayload(raw);
          if (!next) return;

          setAppointments((prev) => {
            if (prev.some((p) => p.id === next.id)) return prev;
            return sortAgendaRowsByDatetime([next, ...prev]);
          });

          setToast(true);
          window.setTimeout(() => setToast(false), 3000);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `doctor_id=eq.${doctorId}`,
        },
        (payload) => {
          const raw = payload.new as Record<string, unknown> | null;
          if (!raw) return;
          const next = agendaRowFromSupabasePayload(raw);
          if (!next) return;

          setAppointments((prev) => {
            const idx = prev.findIndex((p) => p.id === next.id);
            if (idx === -1) {
              return sortAgendaRowsByDatetime([next, ...prev]);
            }
            const copy = [...prev];
            copy[idx] = next;
            return sortAgendaRowsByDatetime(copy);
          });

          setToast(true);
          window.setTimeout(() => setToast(false), 3000);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "appointments",
        },
        () => {
          // DELETE payloads may not include doctor_id depending on replica identity,
          // so do a targeted resync to avoid stale rows across simultaneous sessions.
          void refreshAppointmentsFromServer();
          setToast(true);
          window.setTimeout(() => setToast(false), 3000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId, refreshAppointmentsFromServer, supabase]);

  React.useEffect(() => {
    if (!doctorId) return;
    // Initial sync when component mounts/doctor changes.
    void refreshAppointmentsFromServer();
    const onVisibilityOrFocus = () => {
      void refreshAppointmentsFromServer();
    };
    window.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);
    return () => {
      window.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [doctorId, refreshAppointmentsFromServer]);

  React.useEffect(() => {
    if (!doctorId) return;
    // Realtime can be flaky on some mobile networks/background states.
    // Keep sessions eventually consistent with a light polling fallback.
    const id = window.setInterval(() => {
      void refreshAppointmentsFromServer();
    }, 10000);
    return () => window.clearInterval(id);
  }, [doctorId, refreshAppointmentsFromServer]);

  const nowUtc = new Date();
  const nowCyprus = utcToZonedTime(nowUtc, CY_TZ);
  const todayDate = startOfDay(nowCyprus);
  const todayKey = format(nowCyprus, "yyyy-MM-dd");

  const defaultSlotMinutes =
    workingHours?.slotDurationMinutes && workingHours.slotDurationMinutes > 0
      ? workingHours.slotDurationMinutes
      : 30;

  const nowMs = nowUtc.getTime();
  const selectedStatus = String(selected?.status ?? "").toUpperCase();
  const selectedPast = selected
    ? isVisitSlotEnded(
        selected.gridStartIso,
        selected.rowDurationMinutes,
        nowMs,
      )
    : false;
  const selectedProposalLive = selected
    ? isRescheduleProposalLive(
        selected.status,
        selected.proposal_expires_at,
        nowMs,
      )
    : false;
  const selectedNoShow = selected
    ? isNoShowAttendance(selected.attendance)
    : false;
  const expanded = expandAgendaAppointmentsForGrid(appointments, nowMs);
  const rows = expanded.map((a) => {
    const utc = a.gridStartIso;
    const dateKey = appointmentDateKeyCyprus(utc);
    const minutesFromStart = appointmentMinutesFromAgendaStart(utc, START_HOUR);
    const rawDm = a.duration_minutes;
    const rowDurationMinutes =
      typeof rawDm === "number" && Number.isFinite(rawDm) && rawDm > 0
        ? rawDm
        : defaultSlotMinutes;
    const su = String(a.status ?? "").toUpperCase();
    const isPendingRequest = su === "REQUESTED" || su === "NEEDS_RESCHEDULE";
    const isRequested = su === "REQUESTED";
    return {
      ...a,
      dateKey,
      dateLabel: formatInTimeZone(new Date(utc), CY_TZ, "dd/MM/yyyy", {
        locale: enGB,
      }),
      timeLabel: appointmentTimeLabelCyprus(utc),
      minutesFromStart,
      rowDurationMinutes,
      isPendingRequest,
      isRequested,
      showReviewLink: su === "REQUESTED",
      sortKeyMs: new Date(utc).getTime(),
    };
  });

  const selectedMobileDate = addDays(todayDate, mobileDayOffset);
  const selectedMobileKey = format(selectedMobileDate, "yyyy-MM-dd");
  const mobileRows = rows
    .filter((r) => r.dateKey === selectedMobileKey)
    .sort((a, b) => a.sortKeyMs - b.sortKeyMs);
  const weekStart = startOfWeek(addWeeks(todayDate, weekOffset), {
    weekStartsOn: 1,
  });

  React.useEffect(() => {
    const raw = String(initialDateKey ?? "").trim();
    if (!raw) return;
    const parsed = parseISO(raw);
    if (!isValid(parsed)) return;
    const targetDay = startOfDay(parsed);
    setMobileDayOffset(differenceInCalendarDays(targetDay, todayDate));

    const targetWeekStart = startOfWeek(targetDay, { weekStartsOn: 1 });
    const todayWeekStart = startOfWeek(todayDate, { weekStartsOn: 1 });
    const weekDeltaDays = differenceInCalendarDays(targetWeekStart, todayWeekStart);
    setWeekOffset(Math.round(weekDeltaDays / 7));
  }, [initialDateKey, todayDate]);
  const weekDays = React.useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekKeys = weekDays.map((d) => format(d, "yyyy-MM-dd"));
  const hours = React.useMemo(
    () =>
      Array.from(
        { length: END_HOUR - START_HOUR + 1 },
        (_, i) => START_HOUR + i,
      ),
    [],
  );
  const dayHeight = (END_HOUR - START_HOUR) * HOUR_ROW_HEIGHT;
  const maxMinutes = (END_HOUR - START_HOUR) * 60;
  const appointmentDurationMinutes = defaultSlotMinutes;

  function blockHeightFor(row: (typeof rows)[number]): number {
    const h = (row.rowDurationMinutes / 60) * HOUR_ROW_HEIGHT - 2;
    return Math.max(22, h);
  }

  const todayCount = rows.filter(
    (r) =>
      r.dateKey === todayKey &&
      String(r.status ?? "").toUpperCase() === "CONFIRMED",
  ).length;
  const mobileShowsToday = selectedMobileKey === todayKey;

  function toMinutesFromMidnight(
    time: string | null | undefined,
  ): number | null {
    if (!time) return null;
    const [hRaw, mRaw] = time.split(":");
    const h = Number.parseInt(hRaw ?? "", 10);
    const m = Number.parseInt(mRaw ?? "", 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function dayKeyForDate(d: Date): keyof WeeklySchedule {
    const map: Array<keyof WeeklySchedule> = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return map[d.getDay()];
  }

  function workingWindowsForDate(d: Date): {
    enabled: boolean;
    start: number;
    end: number;
    breakStart: number | null;
    breakEnd: number | null;
  } {
    if (!workingHours) {
      return {
        enabled: true,
        start: START_HOUR * 60,
        end: END_HOUR * 60,
        breakStart: null,
        breakEnd: null,
      };
    }
    const dayCfg = workingHours.weeklySchedule[dayKeyForDate(d)];
    const start = toMinutesFromMidnight(dayCfg?.start_time) ?? START_HOUR * 60;
    const end = toMinutesFromMidnight(dayCfg?.end_time) ?? END_HOUR * 60;
    const breakStart = toMinutesFromMidnight(workingHours.breakStart);
    const breakEnd = toMinutesFromMidnight(workingHours.breakEnd);
    return {
      enabled: Boolean(dayCfg?.enabled),
      start,
      end,
      breakStart,
      breakEnd,
    };
  }

  async function handleCancelAppointment() {
    if (!selected || !cancelMode) return;
    const selectedId = selected.id;
    setCancelError(null);
    setIsCancelling(true);
    try {
      if (cancelMode === "requested") {
        const reason = rejectReason.trim();
        if (reason.length < 10) {
          setCancelError("Please enter a reason (at least 10 characters).");
          setIsCancelling(false);
          return;
        }
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(selectedId)}/reject`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const message = data?.message || "We could not decline this request.";
          setCancelError(message);
          sonnerToast.error(message);
          setIsCancelling(false);
          return;
        }
        sonnerToast.success(
          "Your message was sent to the patient by email and the request was removed from your agenda.",
        );
      } else {
        const reason = rejectReason.trim();
        if (reason.length < 10) {
          setCancelError("Please enter a reason (at least 10 characters).");
          setIsCancelling(false);
          return;
        }
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(selectedId)}/cancel-confirmed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const message =
            data?.message || "We could not cancel this appointment.";
          setCancelError(message);
          sonnerToast.error(message);
          setIsCancelling(false);
          return;
        }
        sonnerToast.success(
          "The patient was emailed about the cancellation and the visit was removed from your agenda.",
        );
      }
      setAppointments((prev) => prev.filter((a) => a.id !== selectedId));
      setSelected(null);
      setConfirmingCancel(false);
      setCancelMode(null);
      setRejectReason("");
      setCancelError(null);
      setIsCancelling(false);
    } catch (err) {
      console.error(err);
      const message = "Something went wrong. Please try again.";
      setCancelError(message);
      sonnerToast.error(message);
      setIsCancelling(false);
    }
  }

  async function loadRescheduleAlternatives() {
    if (!selected) return;
    setRescheduleError(null);
    setPreviewSlots(null);
    setLoadingAlternatives(true);
    try {
      const res = await fetch(
        `/api/appointments/${encodeURIComponent(selected.id)}/alternative-slots?durationMinutes=${rescheduleDuration}`,
        { method: "GET", credentials: "include" },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setRescheduleError(
          typeof data?.message === "string"
            ? data.message
            : "Could not load alternative times.",
        );
        setLoadingAlternatives(false);
        return;
      }
      const slots = (data as { slots?: string[] }).slots ?? [];
      if (slots.length < 3) {
        setRescheduleError(
          "Not enough open times were found. Try a shorter visit length or extend your booking horizon in settings.",
        );
        setLoadingAlternatives(false);
        return;
      }
      setPreviewSlots(slots.slice(0, 3));
    } catch {
      setRescheduleError("Could not load alternative times.");
    } finally {
      setLoadingAlternatives(false);
    }
  }

  async function sendRescheduleProposal() {
    if (!selected || sendingProposal) return;
    if (rescheduleReason.trim().length < 10) {
      setRescheduleError("Please explain the reason (at least 10 characters).");
      return;
    }
    setRescheduleError(null);
    setSendingProposal(true);
    try {
      const selectedId = selected.id;
      const res = await fetch(
        `/api/appointments/${encodeURIComponent(selectedId)}/propose-reschedule`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            durationMinutes: rescheduleDuration,
            rescheduleReason: rescheduleReason.trim(),
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setRescheduleError(
          typeof data?.message === "string"
            ? data.message
            : "Could not send the proposal.",
        );
        sonnerToast.error("Could not send the proposal.");
        setSendingProposal(false);
        return;
      }

      const slots = Array.isArray((data as { slots?: unknown }).slots)
        ? ((data as { slots: string[] }).slots ?? [])
        : [];
      const proposalExpiresAt = String(
        (data as { proposalExpiresAt?: string }).proposalExpiresAt ?? "",
      );
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === selectedId
            ? {
                ...a,
                status: "NEEDS_RESCHEDULE",
                duration_minutes: rescheduleDuration,
                proposed_slots: slots,
                proposal_expires_at: proposalExpiresAt || null,
              }
            : a,
        ),
      );
      sonnerToast.success(
        "Reschedule options sent to the patient. Waiting for their choice.",
      );
      setSelected(null);
      setRescheduleOpen(false);
      setPreviewSlots(null);
      setRescheduleError(null);
      setRescheduleReason("");
      setSendingProposal(false);
    } catch {
      setRescheduleError("Could not send the proposal.");
      sonnerToast.error("Could not send the proposal.");
      setSendingProposal(false);
    }
  }

  async function setAttendanceNoShow(markNoShow: boolean) {
    if (!selected || markingAttendance) return;
    setAttendanceError(null);
    setMarkingAttendance(true);
    const selectedId = selected.id;
    try {
      const res = await fetch(
        `/api/appointments/${encodeURIComponent(selectedId)}/attendance`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attendance: markNoShow ? APPOINTMENT_ATTENDANCE_NO_SHOW : null,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAttendanceError(
          typeof data?.message === "string"
            ? data.message
            : "Could not save attendance.",
        );
        return;
      }
      const nextAttendance = markNoShow ? APPOINTMENT_ATTENDANCE_NO_SHOW : null;
      setAppointments((prev) =>
        prev.map((row) =>
          row.id === selectedId
            ? { ...row, attendance: nextAttendance }
            : row,
        ),
      );
      setSelected((prev) =>
        prev && prev.id === selectedId
          ? { ...prev, attendance: nextAttendance }
          : prev,
      );
    } catch {
      setAttendanceError("Something went wrong. Please try again.");
    } finally {
      setMarkingAttendance(false);
    }
  }

  function openAppointment(row: (typeof rows)[number]) {
    setAttendanceError(null);
    setCancelError(null);
    setConfirmingCancel(false);
    setCancelMode(null);
    setRejectReason("");
    setRescheduleOpen(false);
    setRescheduleError(null);
    setPreviewSlots(null);
    setLoadingAlternatives(false);
    setSendingProposal(false);
    setRescheduleDuration(
      closestAllowedDuration(
        typeof row.duration_minutes === "number" && row.duration_minutes > 0
          ? row.duration_minutes
          : defaultSlotMinutes,
      ),
    );
    setSelected(row);
  }

  function openCancelFlow(row: (typeof rows)[number]) {
    const su = String(row.status ?? "").toUpperCase();
    if (su === "NEEDS_RESCHEDULE") return;
    const past = isVisitSlotEnded(row.gridStartIso, row.rowDurationMinutes, nowMs);
    if (past && su !== "REQUESTED") return;
    setCancelError(null);
    setRejectReason("");
    setSelected(row);
    setRescheduleOpen(false);
    setRescheduleError(null);
    setPreviewSlots(null);
    setCancelMode(su === "REQUESTED" ? "requested" : "confirmed");
    setConfirmingCancel(true);
  }

  function openRescheduleFlow(row: (typeof rows)[number]) {
    const su = String(row.status ?? "").toUpperCase();
    if (su !== "CONFIRMED") return;
    if (isVisitSlotEnded(row.gridStartIso, row.rowDurationMinutes, nowMs)) return;
    setSelected(row);
    setConfirmingCancel(false);
    setCancelMode(null);
    setRejectReason("");
    setCancelError(null);
    setRescheduleError(null);
    setPreviewSlots(null);
    setRescheduleReason("");
    setRescheduleDuration(
      closestAllowedDuration(
        typeof row.duration_minutes === "number" && row.duration_minutes > 0
          ? row.duration_minutes
          : defaultSlotMinutes,
      ),
    );
    setRescheduleOpen(true);
  }

  function topForRow(row: (typeof rows)[number]): number {
    const minutes = Math.min(Math.max(row.minutesFromStart, 0), maxMinutes);
    return (minutes / 60) * HOUR_ROW_HEIGHT;
  }

  type PositionedRow = (typeof rows)[number] & {
    column: number;
    columns: number;
  };

  function layoutOverlaps(dayRows: (typeof rows)[number][]): PositionedRow[] {
    const sorted = [...dayRows].sort((a, b) => a.sortKeyMs - b.sortKeyMs);
    const output: PositionedRow[] = [];
    let i = 0;

    while (i < sorted.length) {
      const cluster: Array<{
        row: (typeof rows)[number];
        start: number;
        end: number;
      }> = [];
      let clusterEnd = -1;

      while (i < sorted.length) {
        const row = sorted[i];
        const start = Math.min(Math.max(row.minutesFromStart, 0), maxMinutes);
        const end = Math.min(start + row.rowDurationMinutes, maxMinutes);
        if (cluster.length === 0 || start < clusterEnd) {
          cluster.push({ row, start, end });
          clusterEnd = Math.max(clusterEnd, end);
          i += 1;
        } else {
          break;
        }
      }

      const columnEndTimes: number[] = [];
      const placed: Array<{ row: (typeof rows)[number]; column: number }> = [];
      for (const item of cluster) {
        let col = columnEndTimes.findIndex((end) => end <= item.start);
        if (col === -1) {
          col = columnEndTimes.length;
          columnEndTimes.push(item.end);
        } else {
          columnEndTimes[col] = item.end;
        }
        placed.push({ row: item.row, column: col });
      }

      const columns = Math.max(1, columnEndTimes.length);
      for (const p of placed) {
        output.push({ ...p.row, column: p.column, columns });
      }
    }

    return output;
  }

  return (
    <>
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-2xl border border-clinical-400/30 bg-slate-900/90 px-4 py-3 text-xs font-medium text-clinical-200 shadow-2xl shadow-ink-900/60 backdrop-blur">
          New booking activity
        </div>
      )}

      <section className="min-w-0 rounded-3xl border border-clinical-100/10 bg-slate-900/50 shadow-2xl shadow-ink-900/50 backdrop-blur-xl">
        <div className="border-b border-slate-800/60 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold text-slate-200">
                {format(nowCyprus, "dd/MM/yyyy", { locale: enGB })}
              </h2>
              <p className="text-xs leading-snug text-slate-400">
                {todayCount === 0 ? (
                  "No appointments today"
                ) : (
                  <>
                    <span className="font-semibold tabular-nums text-clinical-300">
                      {todayCount}
                    </span>{" "}
                    {todayCount === 1 ? "appointment today" : "appointments today"}
                  </>
                )}
              </p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => setManualBookingOpen(true)}
                title="Took a phone call? Block the slot manually here. Next time, share your link to save time."
                className="rounded-lg border border-clinical-300/40 bg-clinical-400/10 px-3 py-1.5 text-xs font-semibold text-clinical-100 transition hover:border-clinical-300/60 hover:bg-clinical-400/20"
              >
                + Add Manual Booking
              </button>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => {
                  setWeekOffset(0);
                  setMobileDayOffset(0);
                }}
                className="rounded-lg border border-clinical-400/30 bg-clinical-400/10 px-2.5 py-1.5 text-xs font-medium text-clinical-200 transition hover:border-clinical-300/50 hover:bg-clinical-400/20"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70 text-slate-300 transition hover:border-slate-500 hover:text-white"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-xs text-slate-400">
                {format(weekDays[0], "dd MMM", { locale: enGB })} -{" "}
                {format(weekDays[4], "dd MMM", { locale: enGB })}
              </p>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70 text-slate-300 transition hover:border-slate-500 hover:text-white"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileDayOffset((v) => v - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70 text-slate-300 transition hover:border-slate-500 hover:text-white"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-xs font-medium text-slate-300">
              {format(selectedMobileDate, "EEE, dd MMM", { locale: enGB })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setWeekOffset(0);
                  setMobileDayOffset(0);
                }}
                className="rounded-lg border border-clinical-400/30 bg-clinical-400/10 px-2 py-1 text-[11px] font-medium text-clinical-200 transition hover:border-clinical-300/50 hover:bg-clinical-400/20"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setMobileDayOffset((v) => v + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70 text-slate-300 transition hover:border-slate-500 hover:text-white"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
          <div className="md:hidden">
            {mobileRows.length === 0 && !mobileShowsToday ? (
              <p className="mb-2 text-center text-xs text-slate-500">
                No appointments this day
              </p>
            ) : null}
            <div className="grid grid-cols-[50px_1fr] gap-3">
                <div
                  className="relative text-[11px] text-slate-500"
                  style={{ height: dayHeight }}
                >
                  {hours.map((hour) => {
                    const y = (hour - START_HOUR) * HOUR_ROW_HEIGHT;
                    return (
                      <span
                        key={hour}
                        className="absolute -translate-y-1/2"
                        style={{ top: y, left: 0 }}
                      >
                        {String(hour).padStart(2, "0")}:00
                      </span>
                    );
                  })}
                </div>
                <div
                  className="relative rounded-2xl border border-slate-800/70 bg-ink-900/45"
                  style={{ height: dayHeight }}
                >
                  {(() => {
                    const w = workingWindowsForDate(selectedMobileDate);
                    const startMin = START_HOUR * 60;
                    const endMin = END_HOUR * 60;
                    const y = (m: number) =>
                      ((m - startMin) / 60) * HOUR_ROW_HEIGHT;
                    const overlays: React.ReactNode[] = [];
                    if (!w.enabled) {
                      overlays.push(
                        <div
                          key="mobile-disabled-day"
                          className="absolute inset-0 bg-slate-900/70"
                        />,
                      );
                    } else {
                      if (w.start > startMin) {
                        overlays.push(
                          <div
                            key="mobile-before-start"
                            className="absolute inset-x-0 bg-slate-900/70"
                            style={{
                              top: 0,
                              height: y(Math.min(w.start, endMin)),
                            }}
                          />,
                        );
                      }
                      if (w.end < endMin) {
                        overlays.push(
                          <div
                            key="mobile-after-end"
                            className="absolute inset-x-0 bg-slate-900/70"
                            style={{
                              top: y(Math.max(w.end, startMin)),
                              bottom: 0,
                            }}
                          />,
                        );
                      }
                      if (
                        w.breakStart != null &&
                        w.breakEnd != null &&
                        w.breakEnd > w.breakStart
                      ) {
                        const top = y(Math.max(w.breakStart, startMin));
                        const bottom = y(Math.min(w.breakEnd, endMin));
                        if (bottom > top) {
                          overlays.push(
                            <div
                              key="mobile-break"
                              className="absolute inset-x-0 bg-slate-900/65"
                              style={{ top, height: bottom - top }}
                            />,
                          );
                        }
                      }
                    }
                    return overlays;
                  })()}
                  {hours.slice(0, -1).map((hour) => {
                    const y = (hour - START_HOUR + 1) * HOUR_ROW_HEIGHT;
                    return (
                      <div
                        key={`mobile-line-${hour}`}
                        className="absolute inset-x-0 border-t border-slate-800/60"
                        style={{ top: y }}
                      />
                    );
                  })}
                    {layoutOverlaps(mobileRows).map((row) => (
                    <button
                      key={row.rowKey}
                      type="button"
                      aria-label={`Appointment ${row.patient_name} at ${row.timeLabel}`}
                      onClick={() => openAppointment(row)}
                      className={`group absolute left-1 right-1 overflow-hidden rounded-xl border text-left shadow-lg transition focus:outline-none focus:ring-2 focus:ring-clinical-300/60 ${
                        row.isCounterOfferHold
                          ? "flex flex-col items-stretch justify-start px-2 py-1.5"
                          : "px-2 py-1"
                      } ${
                        row.isPendingRequest
                          ? "border-amber-300/40 bg-amber-400/15 opacity-[0.72] shadow-amber-500/10 hover:bg-amber-400/25 hover:opacity-95"
                          : "border-clinical-300/40 bg-clinical-400/20 shadow-clinical-500/10 hover:bg-clinical-400/30"
                      }`}
                      style={{
                        top: topForRow(row),
                        height: blockHeightFor(row),
                        left: `${0.25 + (row.column / row.columns) * 99.5}%`,
                        width: `${99.5 / row.columns - 0.5}%`,
                      }}
                    >
                      <AgendaAppointmentCardInner
                        timeLabel={row.timeLabel}
                        patientName={row.patient_name}
                        isPendingRequest={row.isPendingRequest}
                        isRequested={row.isRequested}
                        isCounterOfferHold={row.isCounterOfferHold}
                        isCompactCounterOffer={
                          row.isCounterOfferHold && row.rowDurationMinutes <= 30
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>
          </div>

          <div className="hidden min-w-0 md:block">
            <div className="sticky top-0 z-20 grid grid-cols-[64px_repeat(5,minmax(104px,1fr))] gap-3 border-b border-slate-800/70 bg-slate-900/90 pb-2 pt-1 backdrop-blur lg:grid-cols-[72px_repeat(5,minmax(120px,1fr))] xl:grid-cols-[80px_repeat(5,minmax(140px,1fr))]">
              <div />
              {weekDays.map((day) => (
                <div
                  key={format(day, "yyyy-MM-dd")}
                  className={`min-w-0 rounded-xl border px-2 py-2 text-center text-xs ${
                    isSameDay(day, todayDate)
                      ? "border-clinical-300/40 bg-clinical-400/10 text-clinical-200"
                      : "border-slate-800/80 bg-slate-900/40 text-slate-300"
                  }`}
                >
                  <p className="font-semibold">
                    {format(day, "EEE", { locale: enGB })}
                  </p>
                  <p className="mt-0.5 text-[11px]">
                    {format(day, "dd MMM", { locale: enGB })}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[64px_repeat(5,minmax(104px,1fr))] gap-3 lg:grid-cols-[72px_repeat(5,minmax(120px,1fr))] xl:grid-cols-[80px_repeat(5,minmax(140px,1fr))]">
              <div
                className="relative shrink-0 text-[11px] text-slate-500"
                style={{ height: dayHeight }}
              >
                {hours.map((hour) => {
                  const y = (hour - START_HOUR) * HOUR_ROW_HEIGHT;
                  return (
                    <span
                      key={hour}
                      className="absolute -translate-y-1/2"
                      style={{ top: y, left: 0 }}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  );
                })}
              </div>

              {weekKeys.map((dayKey) => {
                const dayRows = rows
                  .filter((r) => r.dateKey === dayKey)
                  .sort((a, b) => a.sortKeyMs - b.sortKeyMs);
                const dayDate = weekDays[weekKeys.indexOf(dayKey)];
                const work = workingWindowsForDate(dayDate);
                const startMin = START_HOUR * 60;
                const endMin = END_HOUR * 60;
                const y = (m: number) =>
                  ((m - startMin) / 60) * HOUR_ROW_HEIGHT;
                return (
                  <div
                    key={dayKey}
                    className="relative min-w-0 rounded-2xl border border-slate-800/70 bg-ink-900/45"
                    style={{ height: dayHeight }}
                  >
                    {!work.enabled ? (
                      <div className="absolute inset-0 bg-slate-900/70" />
                    ) : (
                      <>
                        {work.start > startMin ? (
                          <div
                            className="absolute inset-x-0 bg-slate-900/70"
                            style={{
                              top: 0,
                              height: y(Math.min(work.start, endMin)),
                            }}
                          />
                        ) : null}
                        {work.end < endMin ? (
                          <div
                            className="absolute inset-x-0 bg-slate-900/70"
                            style={{
                              top: y(Math.max(work.end, startMin)),
                              bottom: 0,
                            }}
                          />
                        ) : null}
                        {work.breakStart != null &&
                        work.breakEnd != null &&
                        work.breakEnd > work.breakStart
                          ? (() => {
                              const top = y(
                                Math.max(work.breakStart!, startMin),
                              );
                              const bottom = y(
                                Math.min(work.breakEnd!, endMin),
                              );
                              if (bottom <= top) return null;
                              return (
                                <div
                                  className="absolute inset-x-0 bg-slate-900/65"
                                  style={{ top, height: bottom - top }}
                                />
                              );
                            })()
                          : null}
                      </>
                    )}
                    {hours.slice(0, -1).map((hour) => {
                      const y = (hour - START_HOUR + 1) * HOUR_ROW_HEIGHT;
                      return (
                        <div
                          key={`${dayKey}-line-${hour}`}
                          className="absolute inset-x-0 border-t border-slate-800/60"
                          style={{ top: y }}
                        />
                      );
                    })}
                    {layoutOverlaps(dayRows).map((row) => (
                      <button
                        key={row.rowKey}
                        type="button"
                        aria-label={`Appointment ${row.patient_name} at ${row.timeLabel}`}
                        onClick={() => openAppointment(row)}
                        className={`group absolute left-1 right-1 overflow-hidden rounded-xl border text-left shadow-lg transition focus:outline-none focus:ring-2 focus:ring-clinical-300/60 ${
                          row.isCounterOfferHold
                            ? "flex flex-col items-stretch justify-start px-2 py-1.5"
                            : "px-2 py-1"
                        } ${
                          row.isPendingRequest
                            ? "border-amber-300/40 bg-amber-400/15 opacity-[0.72] shadow-amber-500/10 hover:bg-amber-400/25 hover:opacity-95"
                            : "border-clinical-300/40 bg-clinical-400/20 shadow-clinical-500/10 hover:bg-clinical-400/30"
                        }`}
                        style={{
                          top: topForRow(row),
                          height: blockHeightFor(row),
                          left: `${0.25 + (row.column / row.columns) * 99.5}%`,
                          width: `${99.5 / row.columns - 0.5}%`,
                        }}
                      >
                        <AgendaAppointmentCardInner
                          timeLabel={row.timeLabel}
                          patientName={row.patient_name}
                          isPendingRequest={row.isPendingRequest}
                          isRequested={row.isRequested}
                          isCounterOfferHold={row.isCounterOfferHold}
                          isCompactCounterOffer={row.isCounterOfferHold && row.rowDurationMinutes <= 30}
                        />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      <ManualBookingFlow
        open={manualBookingOpen}
        doctorId={doctorId}
        doctorSlug={doctorSlug}
        appointments={appointments}
        workingHours={workingHours}
        onClose={() => setManualBookingOpen(false)}
        onBooked={() => {
          void refreshAppointmentsFromServer();
        }}
      />

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
          aria-modal="true"
          role="dialog"
        >
          <button
            type="button"
            onClick={() => {
              if (modalBusy) return;
              setSelected(null);
              setConfirmingCancel(false);
              setCancelMode(null);
              setRejectReason("");
              setCancelError(null);
              setRescheduleOpen(false);
              setRescheduleError(null);
              setPreviewSlots(null);
              setRescheduleReason("");
              setAttendanceError(null);
            }}
            className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm"
            aria-label="Close"
            disabled={modalBusy}
          />
          <div className="relative z-10 w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-clinical-100/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100dvh-2rem)]">
            <button
              type="button"
              onClick={() => {
                if (modalBusy) return;
                setSelected(null);
                setConfirmingCancel(false);
                setCancelMode(null);
                setRejectReason("");
                setCancelError(null);
                setRescheduleOpen(false);
                setRescheduleError(null);
              setPreviewSlots(null);
              setRescheduleReason("");
              setAttendanceError(null);
              }}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close"
              disabled={modalBusy}
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="pr-8 text-lg font-semibold text-slate-50">
              {selected.patient_name}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {selected.dateLabel} · {selected.timeLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {selectedPast ? (
                <p className="inline-flex rounded-full border border-slate-600/80 bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                  Past visit
                </p>
              ) : null}
              {selectedNoShow ? (
                <p className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                  No-show
                </p>
              ) : null}
            </div>
            <div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Reason for visit
              </p>
              <p
                className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${
                  selected.reason ? "text-slate-200" : "text-amber-300"
                }`}
              >
                {selected.reason || "Missing reason (data issue)."}
              </p>
            </div>
            {selected.isCounterOfferHold &&
            String(selected.status ?? "").toUpperCase() ===
              "NEEDS_RESCHEDULE" ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Patient originally requested{" "}
                {formatInTimeZone(
                  new Date(selected.appointment_datetime),
                  CY_TZ,
                  "dd/MM/yyyy",
                  { locale: enGB },
                )}{" "}
                · {appointmentTimeLabelCyprus(selected.appointment_datetime)}
              </p>
            ) : null}
            {selectedPast &&
            !confirmingCancel &&
            !rescheduleOpen ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm leading-relaxed text-slate-400">
                  {selectedStatus === "REQUESTED"
                    ? "This request was not confirmed before the visit time."
                    : selectedStatus === "NEEDS_RESCHEDULE" &&
                        !selectedProposalLive
                      ? "The patient did not choose a new time before the offer expired."
                      : selectedStatus === "CONFIRMED" && selectedNoShow
                        ? "You marked this confirmed visit as a no-show. Details are read-only."
                        : selectedStatus === "CONFIRMED"
                          ? "This visit is in the past. You can mark it as a no-show for your records."
                          : "This visit is in the past. Details are read-only."}
                </p>
                {selectedStatus === "REQUESTED" ? (
                  <button
                    type="button"
                    onClick={() => openCancelFlow(selected)}
                    disabled={openingReview || markingAttendance}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-600 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Close expired request
                  </button>
                ) : null}
                {selectedStatus === "CONFIRMED" ? (
                  selectedNoShow ? (
                    <button
                      type="button"
                      onClick={() => {
                        void setAttendanceNoShow(false);
                      }}
                      disabled={markingAttendance}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-600 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {markingAttendance ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Updating…
                        </>
                      ) : (
                        "Undo no-show"
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void setAttendanceNoShow(true);
                      }}
                      disabled={markingAttendance}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm font-medium text-amber-100 transition hover:border-amber-400/50 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {markingAttendance ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Saving…
                        </>
                      ) : (
                        "Mark as no-show"
                      )}
                    </button>
                  )
                ) : null}
                {attendanceError ? (
                  <p className="text-xs text-amber-300">{attendanceError}</p>
                ) : null}
              </div>
            ) : null}
            {selected.showReviewLink &&
            !selectedPast &&
            !confirmingCancel &&
            !rescheduleOpen ? (
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={openingReview}
                  aria-busy={openingReview}
                  onClick={() => {
                    if (openingReview) return;
                    setOpeningReview(true);
                    emitNavigationStart();
                    router.push(`/dashboard/appointments/${selected.id}`);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-clinical-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-clinical-500/30 transition hover:bg-clinical-300 disabled:cursor-wait disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
                >
                  {openingReview ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Opening review…
                    </>
                  ) : (
                    "Review & confirm request"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => openCancelFlow(selected)}
                  disabled={openingReview}
                  className="inline-flex w-full items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-800/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Decline request
                </button>
              </div>
            ) : selectedStatus === "NEEDS_RESCHEDULE" &&
              !selectedPast &&
              selectedProposalLive &&
              !confirmingCancel &&
              !rescheduleOpen ? (
              <p className="mt-3 text-sm text-amber-200/90">
                Waiting for the patient to choose one of the proposed times.
              </p>
            ) : selectedStatus === "NEEDS_RESCHEDULE" &&
              !selectedProposalLive &&
              !confirmingCancel &&
              !rescheduleOpen ? (
              <p className="mt-3 text-sm text-slate-400">
                The reschedule offer has expired. The patient can book again from
                your profile.
              </p>
            ) : null}
            {selectedStatus === "CONFIRMED" &&
            !selectedPast &&
            !confirmingCancel &&
            !rescheduleOpen ? (
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => openRescheduleFlow(selected)}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-sky-400/50 bg-sky-500/20 px-4 py-3 text-sm font-semibold text-sky-100 shadow-sm shadow-sky-500/10 transition hover:border-sky-400/70 hover:bg-sky-500/30"
                >
                  Reschedule appointment
                </button>
                <button
                  type="button"
                  onClick={() => openCancelFlow(selected)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-800/60 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  Cancel appointment
                </button>
              </div>
            ) : null}

            {rescheduleOpen &&
            selectedStatus === "CONFIRMED" &&
            !selectedPast ? (
              <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-slate-300">
                <p>
                  Propose three new times to the patient. They will receive an
                  email and choose one slot.
                </p>
                <label className="mt-3 block text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Visit duration
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {PROFESSIONAL_DURATION_OPTIONS.map((minutes) => {
                    const active = rescheduleDuration === minutes;
                    return (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => {
                          setRescheduleDuration(minutes);
                          setPreviewSlots(null);
                          setRescheduleError(null);
                        }}
                        className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
                          active
                            ? "border-sky-400/60 bg-sky-400/20 text-sky-100"
                            : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600"
                        }`}
                        disabled={loadingAlternatives || sendingProposal}
                      >
                        {formatProfessionalDurationLabel(minutes)}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRescheduleOpen(false);
                      setRescheduleError(null);
                      setPreviewSlots(null);
                      setRescheduleReason("");
                    }}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                    disabled={loadingAlternatives || sendingProposal}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void loadRescheduleAlternatives();
                    }}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={loadingAlternatives || sendingProposal}
                  >
                    {loadingAlternatives ? "Finding times..." : "Find 3 slots"}
                  </button>
                </div>
                <label className="mt-3 block text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Reason for the patient (required)
                </label>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. I have an urgent hospital procedure and need to move this visit to another time."
                  rows={3}
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none focus:ring-1 focus:ring-clinical-500/40"
                  disabled={loadingAlternatives || sendingProposal}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  At least 10 characters.
                </p>
                {previewSlots && previewSlots.length >= 3 ? (
                  <div className="mt-3 space-y-2 border-t border-slate-700/80 pt-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      Proposed times (Cyprus)
                    </p>
                    <ul className="space-y-1.5 text-xs text-slate-200">
                      {previewSlots.map((iso, i) => (
                        <li
                          key={iso}
                          className="rounded-lg border border-slate-700/70 bg-ink-900/50 px-2.5 py-1.5"
                        >
                          <span className="text-slate-500">{i + 1}. </span>
                          {format(
                            appointmentToCyprusDate(iso),
                            "EEE, d MMM yyyy · HH:mm",
                            { locale: enGB },
                          )}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        void sendRescheduleProposal();
                      }}
                      className="mt-1 inline-flex w-full items-center justify-center rounded-2xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={
                        sendingProposal || rescheduleReason.trim().length < 10
                      }
                    >
                      {sendingProposal ? "Sending..." : "Send proposal to patient"}
                    </button>
                  </div>
                ) : null}
                {rescheduleError ? (
                  <p className="mt-2 text-xs text-amber-300">{rescheduleError}</p>
                ) : null}
              </div>
            ) : null}

            {confirmingCancel && cancelMode ? (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-slate-300">
                {cancelMode === "requested" ? (
                  <>
                    <p>
                      The patient will receive an email with your message and a
                      link to book again on your profile.
                    </p>
                    <label className="mt-3 block text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Reason (required)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. A last-minute surgery came up and I need to free this slot — sorry. Please book another time on my profile."
                      rows={4}
                      className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none focus:ring-1 focus:ring-clinical-500/40"
                      disabled={isCancelling}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      At least 10 characters.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      The patient will receive an email that this confirmed visit
                      is cancelled, with your explanation and a link to book again.
                    </p>
                    <label className="mt-3 block text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Reason (required)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. An emergency procedure requires me to be elsewhere — I’m very sorry to cancel this confirmed slot. Please book again on my profile when you can."
                      rows={4}
                      className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-ink-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-clinical-500/50 focus:outline-none focus:ring-1 focus:ring-clinical-500/40"
                      disabled={isCancelling}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      At least 10 characters.
                    </p>
                  </>
                )}
                <div className="sticky bottom-0 -mx-3 mt-3 border-t border-slate-700/90 bg-slate-900/95 px-3 pb-2 pt-2 backdrop-blur">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingCancel(false);
                        setCancelMode(null);
                        setRejectReason("");
                        setCancelError(null);
                      }}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                    >
                      {cancelMode === "requested" ? "Go back" : "Keep appointment"}
                    </button>
                    <button
                      type="button"
                      disabled={isCancelling || rejectReason.trim().length < 10}
                      onClick={handleCancelAppointment}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:border-red-400/60 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isCancelling
                        ? cancelMode === "requested"
                          ? "Declining…"
                          : "Cancelling…"
                        : cancelMode === "requested"
                          ? "Decline & notify"
                          : "Cancel & notify"}
                    </button>
                  </div>
                </div>
                {cancelError ? (
                  <p className="mt-2 text-xs text-red-300">{cancelError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
