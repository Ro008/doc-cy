"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  format,
  isSameDay,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns";
import { enGB } from "date-fns/locale";
import { formatInTimeZone, utcToZonedTime } from "date-fns-tz";
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Menu, Trash2, X } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { useTranslations } from "next-intl";
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
import { agendaRefreshOutcome } from "@/lib/agenda-refresh";
import { ManualBookingFlow } from "@/components/agenda/ManualBookingFlow";
import { AGENDA_HIGHLIGHT_MS } from "@/lib/agenda-highlight";
import { expandAgendaAppointmentsForGrid } from "@/lib/agenda-grid";
import {
  isExpiredRequest,
  isStoredExpiredStatus,
} from "@/lib/appointment-status";
import { AgendaClinicCalendars } from "@/components/agenda/AgendaClinicCalendars";
import { AgendaMonthGrid, type AgendaMonthItem } from "@/components/agenda/AgendaMonthGrid";
import { AgendaSidebar } from "@/components/agenda/AgendaSidebar";
import {
  agendaGridScrollHeight,
  agendaHourRowHeight,
  agendaHref,
  agendaInitialGridScrollTop,
  agendaRangeTitle,
  agendaWeekDays,
  parseAgendaView,
  shiftAgendaAnchor,
  type AgendaView,
} from "@/lib/agenda-calendar";
import {
  AGENDA_APPOINTMENT_SELECT,
  AGENDA_VISIBLE_STATUSES,
  clinicIdForAppointment,
  unionAgendaWorkingWindows,
  workingWindowForHours,
  type AgendaClinic,
  type AgendaWorkingHours,
} from "@/lib/agenda-clinics";
import { agendaClinicEventColor } from "@/lib/doctor-locations";
import { MANUAL_BOOKING_HINT, MANUAL_BOOKING_LABEL } from "@/lib/manual-booking-copy";
import {
  agendaAppointmentBadgeClass,
  agendaAppointmentConfirmedClass,
  agendaAppointmentExpiredClass,
  agendaAppointmentNameExpiredClass,
  agendaAppointmentNameConfirmedClass,
  agendaAppointmentNamePendingClass,
  agendaAppointmentPendingClass,
  agendaAppointmentTimeClass,
  agendaBreakBandClass,
  agendaCalendarShellClass,
  agendaDayColumnClass,
  agendaDayGridColsClass,
  agendaDayHeaderShellClass,
  agendaDayNameClass,
  agendaDayNumberClass,
  agendaHourAxisClass,
  agendaHourGridLineClass,
  agendaHourAxisLabelClass,
  agendaNavIconButtonClass,
  agendaOffHoursBandClass,
  agendaOffHoursOverlayClass,
  agendaPrimaryChipButtonClass,
  agendaStickyWeekHeaderClass,
  agendaTodayChipButtonClass,
  agendaToolbarDividerClass,
  agendaWeekGridColsClass,
} from "@/components/agenda/agenda-surface";
import { emitNavigationStart } from "@/lib/doccy-navigation";
import {
  DEFAULT_PATIENT_CANCEL_NOTICE_HOURS,
  professionalCancelIsShortNotice,
} from "@/lib/patient-cancel-window";
import {
  APPOINTMENT_ATTENDANCE_NO_SHOW,
  isNoShowAttendance,
} from "@/lib/appointment-attendance";

type AgendaAppointmentRow = {
  id: string;
  professional_id: string;
  patient_name: string;
  patient_phone: string;
  reason?: string | null;
  appointment_datetime: string;
  status?: string | null;
  duration_minutes?: number | null;
  proposed_slots?: unknown;
  proposal_expires_at?: string | null;
  attendance?: string | null;
  location_id?: string | null;
};

function agendaRowFromSupabasePayload(
  raw: Record<string, unknown>,
): AgendaAppointmentRow | null {
  if (typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    professional_id: String(raw.professional_id ?? ""),
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
    location_id:
      raw.location_id == null || raw.location_id === ""
        ? null
        : String(raw.location_id),
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

/** Linked visit: a light edge and soft glow that fade in and out once. */
const AGENDA_SPOTLIGHT_CLASS =
  " motion-safe:animate-spotlight motion-reduce:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.75)]";

function agendaDateFromKey(raw: string | null | undefined): Date | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? startOfDay(parsed) : null;
}

const START_HOUR = 8;
const END_HOUR = 20;
/** Hour height on phones and until the desktop grid has measured the window. */
const DEFAULT_HOUR_ROW_HEIGHT = 56;
/** Room for the first hour label (-translate-y-1/2 at y=0). */
const CALENDAR_TOP_INSET = 14;
/** Room for the lower half of the last hour label ("20:00"), so the grid does not overflow. */
const CALENDAR_BOTTOM_INSET = 10;

function firstNameOf(fullName: string | null | undefined): string {
  return String(fullName ?? "").trim().split(/\s+/)[0] || "the patient";
}

function AgendaAppointmentCardInner({
  timeLabel,
  endTimeLabel,
  patientName,
  isPendingRequest,
  isRequested,
  isExpired = false,
  isCounterOfferHold,
  isCompactCounterOffer,
}: {
  timeLabel: string;
  endTimeLabel?: string;
  patientName: string;
  isPendingRequest: boolean;
  isRequested: boolean;
  isExpired?: boolean;
  isCounterOfferHold: boolean;
  isCompactCounterOffer: boolean;
}) {
  const t = useTranslations("DoctorAgenda");
  const nameColor = isExpired
    ? agendaAppointmentNameExpiredClass
    : isPendingRequest
      ? agendaAppointmentNamePendingClass
      : agendaAppointmentNameConfirmedClass;
  const patientDisplay = patientName.trim() || "Patient";
  const topRightBadge = isExpired
    ? t("appointmentExpiredBadge")
    : isRequested
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
            className={`flex min-h-0 min-w-0 items-center gap-0.5 truncate text-left text-xs font-semibold leading-tight sm:text-[13px] ${nameColor}`}
          >
            <span className={agendaAppointmentTimeClass}>
              {timeLabel}
            </span>
            <span className="shrink-0 text-white/50">·</span>
            <span className="min-w-0 flex-1 truncate" title={patientDisplay}>
              {patientDisplay}
            </span>
            {topRightBadge ? (
              <span
                className={`ml-1 shrink-0 max-w-[3.35rem] truncate ${agendaAppointmentBadgeClass}`}
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
          <span className={agendaAppointmentTimeClass}>
            {timeLabel}
          </span>
        </div>
        {topRightBadge ? (
          <span
            className={`pointer-events-none absolute right-0 top-0 z-10 max-w-[46%] truncate ${agendaAppointmentBadgeClass}`}
            title={topRightBadge}
          >
            {topRightBadge}
          </span>
        ) : null}
        <p className="mt-0.5 min-w-0 truncate text-left text-xs font-semibold leading-tight sm:text-[13px]">
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
          className={`pointer-events-none absolute right-0.5 top-0.5 z-10 max-w-[42%] truncate ${agendaAppointmentBadgeClass}`}
          title={topRightBadge}
        >
          {topRightBadge}
        </span>
      ) : null}
      <div className={`min-w-0 text-left leading-tight ${topRightBadge ? "pr-[2.15rem]" : ""}`} title={cardTitle}>
        <p className={`truncate text-xs font-semibold ${nameColor}`}>{patientDisplay}</p>
        <p className={`truncate ${agendaAppointmentTimeClass} ${nameColor}`}>
          {endTimeLabel ? `${timeLabel} – ${endTimeLabel}` : timeLabel}
        </p>
      </div>
    </>
  );
}

export function AgendaRealtime({
  doctorId,
  doctorSlug,
  initialAppointments,
  workingHours,
  clinics = [],
  initialDateKey,
  initialView,
  openManualBooking,
  highlightAppointmentId,
  patientCancelNoticeHours = DEFAULT_PATIENT_CANCEL_NOTICE_HOURS,
}: {
  doctorId: string | null;
  doctorSlug?: string | null;
  initialAppointments: AgendaAppointmentRow[];
  workingHours: AgendaWorkingHours | null;
  clinics?: AgendaClinic[];
  initialDateKey?: string | null;
  initialView?: string | null;
  openManualBooking?: boolean;
  /** Visit to point out after arriving from a link (e.g. the dashboard's Today). */
  highlightAppointmentId?: string | null;
  /** Her patients can cancel online until this many hours before; inside it, warn her. */
  patientCancelNoticeHours?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tAgenda = useTranslations("DoctorAgenda");
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
        isExpired: boolean;
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
  const [view, setView] = React.useState<AgendaView>(() => parseAgendaView(initialView));
  const [anchorDate, setAnchorDate] = React.useState<Date>(
    () =>
      agendaDateFromKey(initialDateKey) ?? startOfDay(utcToZonedTime(new Date(), CY_TZ)),
  );
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  /** Desktop time grid scrolls inside itself so the page fits the window. */
  const gridScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [gridScrollHeight, setGridScrollHeight] = React.useState<number | null>(null);
  /** Stretched so the working day fills the grid (see agendaHourRowHeight). */
  const [hourRowHeight, setHourRowHeight] = React.useState(DEFAULT_HOUR_ROW_HEIGHT);
  const [manualBookingOpen, setManualBookingOpen] = React.useState(false);
  const [hiddenClinicIds, setHiddenClinicIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const isMultiClinic = clinics.length > 1;

  React.useEffect(() => {
    if (!openManualBooking) return;
    setManualBookingOpen(true);
  }, [openManualBooking]);

  // Linked visit: scroll it into view and spotlight it for a few seconds.
  const [highlightedId, setHighlightedId] = React.useState<string | null>(
    highlightAppointmentId ?? null,
  );
  React.useEffect(() => {
    if (!highlightAppointmentId) return;
    setHighlightedId(highlightAppointmentId);
    let attempts = 0;
    let scrollTimer = 0;
    let clearTimer = 0;
    // The countdown starts once the visit is on screen, so a slow load does not eat it.
    const findAndScroll = () => {
      const el = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-appointment-id="${highlightAppointmentId}"]`),
      ).find((node) => node.offsetParent !== null);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        clearTimer = window.setTimeout(() => setHighlightedId(null), AGENDA_HIGHLIGHT_MS);
      } else if (attempts++ < 30) {
        scrollTimer = window.setTimeout(findAndScroll, 100);
      } else {
        setHighlightedId(null);
      }
    };
    scrollTimer = window.setTimeout(findAndScroll, 120);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightAppointmentId]);

  React.useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  const [signedOut, setSignedOut] = React.useState(false);

  const refreshAppointmentsFromServer = React.useCallback(async () => {
    if (!doctorId) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const { data, error } = session
      ? await supabase
          .from("appointments")
          .select(AGENDA_APPOINTMENT_SELECT)
          .eq("professional_id", doctorId)
          .in("status", [...AGENDA_VISIBLE_STATUSES])
          .order("appointment_datetime", { ascending: true })
          // Send the token checked above. Otherwise the client looks the
          // session up again for the request and, if it vanished in between,
          // silently falls back to the anon key: RLS then answers 200 [] and
          // the list is wiped. With this token the read returns the
          // professional's rows or an error (e.g. JWT expired), and an error
          // keeps the list.
          .setHeader("Authorization", `Bearer ${session.access_token}`)
      : { data: null, error: null };

    const outcome = agendaRefreshOutcome({
      hasSession: Boolean(session),
      error,
      data: data as Record<string, unknown>[] | null,
    });
    if (outcome.kind === "keep") {
      if (outcome.reason === "signed_out") setSignedOut(true);
      return;
    }
    setSignedOut(false);
    const mapped = outcome.rows
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
          filter: `professional_id=eq.${doctorId}`,
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
          filter: `professional_id=eq.${doctorId}`,
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
          // DELETE payloads may not include professional_id depending on replica identity,
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

  const visibleClinicIds = React.useMemo(() => {
    const ids = new Set(
      clinics.map((clinic) => clinic.id).filter((id) => !hiddenClinicIds.has(id)),
    );
    return ids;
  }, [clinics, hiddenClinicIds]);

  const visibleAppointments = React.useMemo(() => {
    // Requests the doctor closed as expired leave the agenda (kept in the DB for stats).
    const open = appointments.filter((row) => !isStoredExpiredStatus(row.status));
    if (!isMultiClinic) return open;
    return open.filter((row) => {
      const clinicId = clinicIdForAppointment(row.location_id, clinics);
      return clinicId != null && visibleClinicIds.has(clinicId);
    });
  }, [appointments, clinics, isMultiClinic, visibleClinicIds]);

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
  const expanded = expandAgendaAppointmentsForGrid(visibleAppointments, nowMs);
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
    // Unanswered request whose time has started: no longer something to accept.
    const isExpired = isExpiredRequest({ status: su, startIso: utc }, nowMs);
    const isPendingRequest = !isExpired && (su === "REQUESTED" || su === "NEEDS_RESCHEDULE");
    const isRequested = !isExpired && su === "REQUESTED";
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
      isExpired,
      showReviewLink: su === "REQUESTED" && !isExpired,
      sortKeyMs: new Date(utc).getTime(),
    };
  });

  const anchorKey = format(anchorDate, "yyyy-MM-dd");
  const anchorIsToday = anchorKey === todayKey;
  /** Phones get Day and Month only; a week of 7 columns does not fit. */
  const mobileView: AgendaView = view === "month" ? "month" : "day";
  const gridDays = view === "day" ? [anchorDate] : agendaWeekDays(anchorDate);

  React.useEffect(() => {
    const target = agendaDateFromKey(initialDateKey);
    if (target) setAnchorDate(target);
  }, [initialDateKey]);

  React.useEffect(() => {
    const href = agendaHref({ view, dateKey: anchorIsToday ? null : anchorKey });
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(window.history.state, "", href);
    }
  }, [view, anchorKey, anchorIsToday]);

  const rowsByDay = new Map<string, (typeof rows)[number][]>();
  for (const row of rows) {
    const list = rowsByDay.get(row.dateKey);
    if (list) list.push(row);
    else rowsByDay.set(row.dateKey, [row]);
  }
  for (const list of rowsByDay.values()) list.sort((a, b) => a.sortKeyMs - b.sortKeyMs);
  const rowsForDay = (dateKey: string) => rowsByDay.get(dateKey) ?? [];
  const anchorRows = rowsForDay(anchorKey);
  const hours = React.useMemo(
    () =>
      Array.from(
        { length: END_HOUR - START_HOUR + 1 },
        (_, i) => START_HOUR + i,
      ),
    [],
  );
  const dayHeight = (END_HOUR - START_HOUR) * hourRowHeight;
  const calendarBodyHeight = dayHeight + CALENDAR_TOP_INSET + CALENDAR_BOTTOM_INSET;
  const maxMinutes = (END_HOUR - START_HOUR) * 60;
  const appointmentDurationMinutes = defaultSlotMinutes;

  function blockHeightFor(row: (typeof rows)[number]): number {
    const h = (row.rowDurationMinutes / 60) * hourRowHeight - 2;
    return Math.max(22, h);
  }

  const todayCount = rows.filter(
    (r) =>
      r.dateKey === todayKey &&
      String(r.status ?? "").toUpperCase() === "CONFIRMED",
  ).length;

  function workingWindowsForDate(d: Date): {
    enabled: boolean;
    start: number;
    end: number;
    breakStart: number | null;
    breakEnd: number | null;
  } {
    const visibleClinics = clinics.filter((clinic) => visibleClinicIds.has(clinic.id));
    if (visibleClinics.length > 0) {
      return unionAgendaWorkingWindows(
        visibleClinics.map((clinic) =>
          workingWindowForHours(clinic.hours, d, START_HOUR, END_HOUR),
        ),
      );
    }
    if (isMultiClinic) {
      return {
        enabled: false,
        start: START_HOUR * 60,
        end: END_HOUR * 60,
        breakStart: null,
        breakEnd: null,
      };
    }
    return workingWindowForHours(workingHours, d, START_HOUR, END_HOUR);
  }

  function clinicIndexForRow(locationId: string | null | undefined): number {
    const clinicId = clinicIdForAppointment(locationId, clinics);
    const index = clinics.findIndex((clinic) => clinic.id === clinicId);
    return index >= 0 ? index : 0;
  }

  function clinicNameForRow(locationId: string | null | undefined): string | null {
    if (!isMultiClinic) return null;
    const clinicId = clinicIdForAppointment(locationId, clinics);
    return clinics.find((clinic) => clinic.id === clinicId)?.name ?? null;
  }

  function appointmentChipClass(isPendingRequest: boolean, isExpired = false): string {
    if (isExpired) return agendaAppointmentExpiredClass;
    return isPendingRequest
      ? agendaAppointmentPendingClass
      : agendaAppointmentConfirmedClass;
  }

  function clinicSwatchClass(locationId: string | null | undefined): string | null {
    if (!isMultiClinic) return null;
    return agendaClinicEventColor(clinicIndexForRow(locationId)).swatch;
  }

  function toggleClinicCalendar(clinicId: string) {
    setHiddenClinicIds((prev) => {
      const next = new Set(prev);
      if (next.has(clinicId)) next.delete(clinicId);
      else next.add(clinicId);
      return next;
    });
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
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          patientHasEmail?: boolean;
          patientPhone?: string | null;
        } | null;
        if (!res.ok) {
          const message =
            data?.message || "We could not cancel this appointment.";
          setCancelError(message);
          sonnerToast.error(message);
          setIsCancelling(false);
          return;
        }
        if (data?.patientHasEmail === false) {
          // No email on file: nobody told the patient yet (user, 2026-10-04).
          sonnerToast.warning(
            `Visit cancelled. This patient has no email: please call them${
              data.patientPhone ? ` on ${data.patientPhone}` : ""
            } to let them know.`,
            { duration: 20_000 },
          );
        } else {
          sonnerToast.success(
            "The patient was emailed about the cancellation and the visit was removed from your agenda.",
          );
        }
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
    setCancelMode(su === "REQUESTED" ? "requested" : "confirmed");
    setConfirmingCancel(true);
  }

  function topForRow(row: (typeof rows)[number]): number {
    const minutes = Math.min(Math.max(row.minutesFromStart, 0), maxMinutes);
    return CALENDAR_TOP_INSET + (minutes / 60) * hourRowHeight;
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

  function goToToday() {
    setAnchorDate(todayDate);
  }

  function shiftAnchor(delta: number) {
    setAnchorDate((date) => shiftAgendaAnchor(date, view, delta));
  }

  function shiftMobile(delta: number) {
    setAnchorDate((date) => shiftAgendaAnchor(date, mobileView, delta));
  }

  function openDay(date: Date) {
    setAnchorDate(startOfDay(date));
    setView("day");
  }

  const pendingRows = rows
    .filter(
      (row) =>
        row.isRequested &&
        !isVisitSlotEnded(row.gridStartIso, row.rowDurationMinutes, nowMs),
    )
    .sort((a, b) => a.sortKeyMs - b.sortKeyMs);

  const nowMinutesCyprus = nowCyprus.getHours() * 60 + nowCyprus.getMinutes();
  const nowLineTop =
    nowMinutesCyprus >= START_HOUR * 60 && nowMinutesCyprus <= END_HOUR * 60
      ? CALENDAR_TOP_INSET + ((nowMinutesCyprus - START_HOUR * 60) / 60) * hourRowHeight
      : null;

  const todayInGrid = gridDays.some((day) => isSameDay(day, todayDate));
  const gridKey = `${view}-${format(gridDays[0]!, "yyyy-MM-dd")}`;

  React.useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;
    const measure = () => {
      const grid = gridScrollRef.current;
      // Phones use the day list below the grid; the desktop grid is hidden there.
      if (!grid || grid.offsetParent === null) {
        setHourRowHeight(DEFAULT_HOUR_ROW_HEIGHT);
        return;
      }
      const gridTop = grid.getBoundingClientRect().top + window.scrollY;
      // Section + page bottom padding; below lg the bottom tab bar (5.25rem) covers the page too.
      const bottomReserve = 40 + (window.innerWidth >= 1024 ? 0 : 84);
      const available = agendaGridScrollHeight({
        viewportHeight: window.innerHeight,
        gridTop,
        bottomReserve,
      });
      setGridScrollHeight(available);
      setHourRowHeight(
        agendaHourRowHeight({
          availablePx: available,
          hours: END_HOUR - START_HOUR,
          topInset: CALENDAR_TOP_INSET + CALENDAR_BOTTOM_INSET,
        }),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view, sidebarOpen]);

  React.useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;
    el.scrollTop = agendaInitialGridScrollTop({
      nowOffsetPx: todayInGrid ? nowLineTop : null,
      hourRowHeight: hourRowHeight,
    });
    // When the visible range changes (and once the grid has its height), not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridKey, gridScrollHeight != null]);

  function monthItemsForDay(dateKey: string): AgendaMonthItem[] {
    return rowsForDay(dateKey).map((row) => ({
      key: row.rowKey,
      timeLabel: row.timeLabel,
      patientName: row.patient_name.trim() || "Patient",
      clinicName: clinicNameForRow(row.location_id),
      isPendingRequest: row.isPendingRequest,
      dotClass: row.isExpired
        ? "bg-slate-500"
        : (clinicSwatchClass(row.location_id) ?? "bg-clinical-400"),
      onOpen: () => openAppointment(row),
    }));
  }

  function renderViewSwitcher(options: AgendaView[], current: AgendaView) {
    return (
      <div
        role="group"
        aria-label="Calendar view"
        data-testid="agenda-view-switcher"
        className="inline-flex overflow-hidden rounded-full border border-white/25"
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === current}
            onClick={() => setView(option)}
            className={`px-4 py-1.5 text-[13px] font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clinical-400/70 ${
              option === current
                ? "bg-clinical-500/20 text-clinical-200"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  function renderHourAxis() {
    return (
      <div className={agendaHourAxisClass} style={{ height: calendarBodyHeight }}>
        {hours.map((hour) => (
          <span
            key={hour}
            className={agendaHourAxisLabelClass(hour, START_HOUR)}
            style={{ top: CALENDAR_TOP_INSET + (hour - START_HOUR) * hourRowHeight, left: 0 }}
          >
            {String(hour).padStart(2, "0")}:00
          </span>
        ))}
      </div>
    );
  }

  function renderDayColumn(dayDate: Date, keyPrefix: string) {
    const dayKey = format(dayDate, "yyyy-MM-dd");
    const isTodayCol = isSameDay(dayDate, todayDate);
    const work = workingWindowsForDate(dayDate);
    const startMin = START_HOUR * 60;
    const endMin = END_HOUR * 60;
    const y = (m: number) => CALENDAR_TOP_INSET + ((m - startMin) / 60) * hourRowHeight;
    return (
      <div
        key={`${keyPrefix}-${dayKey}`}
        className={agendaDayColumnClass(isTodayCol)}
        style={{ height: calendarBodyHeight }}
      >
        {!work.enabled ? (
          <div className={agendaOffHoursOverlayClass} />
        ) : (
          <>
            {work.start > startMin ? (
              <div
                className={agendaOffHoursBandClass}
                style={{ top: 0, height: y(Math.min(work.start, endMin)) }}
              />
            ) : null}
            {work.end < endMin ? (
              <div
                className={agendaOffHoursBandClass}
                style={{ top: y(Math.max(work.end, startMin)), bottom: 0 }}
              />
            ) : null}
            {work.breakStart != null && work.breakEnd != null && work.breakEnd > work.breakStart
              ? (() => {
                  const top = y(Math.max(work.breakStart!, startMin));
                  const bottom = y(Math.min(work.breakEnd!, endMin));
                  if (bottom <= top) return null;
                  return (
                    <div className={agendaBreakBandClass} style={{ top, height: bottom - top }} />
                  );
                })()
              : null}
          </>
        )}
        {hours.slice(0, -1).map((hour) => (
          <div
            key={`${dayKey}-line-${hour}`}
            className={agendaHourGridLineClass}
            style={{ top: CALENDAR_TOP_INSET + (hour - START_HOUR + 1) * hourRowHeight }}
          />
        ))}
        {layoutOverlaps(rowsForDay(dayKey)).map((row) => (
          <button
            key={row.rowKey}
            type="button"
            aria-label={`Appointment ${row.patient_name} at ${row.timeLabel}${clinicNameForRow(row.location_id) ? ` · ${clinicNameForRow(row.location_id)}` : ""}`}
            data-appointment-id={row.id}
            data-highlighted={highlightedId === row.id ? "true" : "false"}
            data-expired={row.isExpired ? "true" : "false"}
            onClick={() => openAppointment(row)}
            className={`group absolute overflow-hidden rounded-md border text-left transition focus:outline-none ${
              row.isCounterOfferHold
                ? `flex flex-col items-stretch justify-start py-1 pr-1.5 ${isMultiClinic ? "pl-2.5" : "pl-1.5"}`
                : `py-0.5 pr-1.5 ${isMultiClinic ? "pl-2.5" : "pl-1.5"}`
            } ${appointmentChipClass(row.isPendingRequest, row.isExpired)}${
              highlightedId === row.id ? AGENDA_SPOTLIGHT_CLASS : ""
            }`}
            style={{
              top: topForRow(row) + 1,
              height: blockHeightFor(row) - 1,
              left: `calc(${(row.column / row.columns) * 100}% + 2px)`,
              width: `calc(${100 / row.columns}% - 4px)`,
            }}
          >
            {clinicSwatchClass(row.location_id) ? (
              <span
                className={`absolute inset-y-0 left-0 w-1 ${clinicSwatchClass(row.location_id)}`}
                aria-hidden
              />
            ) : null}
            <AgendaAppointmentCardInner
              timeLabel={row.timeLabel}
              endTimeLabel={appointmentTimeLabelCyprus(
                new Date(new Date(row.gridStartIso).getTime() + row.rowDurationMinutes * 60_000).toISOString(),
              )}
              patientName={row.patient_name}
              isPendingRequest={row.isPendingRequest}
              isRequested={row.isRequested}
              isExpired={row.isExpired}
              isCounterOfferHold={row.isCounterOfferHold}
              isCompactCounterOffer={row.isCounterOfferHold && row.rowDurationMinutes <= 30}
            />
          </button>
        ))}
        {isTodayCol && nowLineTop != null ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
            style={{ top: nowLineTop - 5 }}
            data-testid="agenda-now-line"
            aria-hidden
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" />
            <span className="h-0.5 flex-1 bg-rose-400" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-2xl border border-clinical-400/30 bg-slate-900/90 px-4 py-3 text-xs font-medium text-clinical-200 shadow-2xl shadow-ink-900/60 backdrop-blur">
          New booking activity
        </div>
      )}

      {signedOut && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          <span>{tAgenda("signedOutNotice")}</span>
          <a
            href={`/login?next=${encodeURIComponent("/agenda")}`}
            className="shrink-0 rounded-full border border-amber-400/50 px-3 py-1 text-xs font-semibold text-amber-50 transition hover:bg-amber-500/20"
          >
            {tAgenda("signedOutSignIn")}
          </a>
        </div>
      )}

      <section className={agendaCalendarShellClass}>
        <div className={`${agendaToolbarDividerClass} px-3 py-2.5 sm:px-4 md:py-2`}>
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className={`${agendaNavIconButtonClass} hidden lg:inline-flex`}
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-4 w-4" />
            </button>
            <button type="button" onClick={goToToday} className={agendaTodayChipButtonClass}>
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftAnchor(-1)}
              className={agendaNavIconButtonClass}
              aria-label={`Previous ${view}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => shiftAnchor(1)}
              className={agendaNavIconButtonClass}
              aria-label={`Next ${view}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <h2
              className="ml-1 min-w-0 truncate text-lg font-medium text-white lg:text-xl"
              data-testid="agenda-range-title"
            >
              {agendaRangeTitle(anchorDate, view)}
            </h2>
            <div className="flex-1" />
            <p className="text-xs leading-snug text-slate-300 md:text-[13px]">
              {todayCount === 0 ? (
                "No appointments today"
              ) : (
                <>
                  <span className="font-bold tabular-nums text-clinical-300">{todayCount}</span>{" "}
                  {todayCount === 1 ? "appointment today" : "appointments today"}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => setManualBookingOpen(true)}
              title={MANUAL_BOOKING_HINT}
              className={`${agendaPrimaryChipButtonClass} ${sidebarOpen ? "lg:hidden" : ""}`}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
              {MANUAL_BOOKING_LABEL}
            </button>
            {renderViewSwitcher(["day", "week", "month"], view)}
          </div>
          <AgendaClinicCalendars
            clinics={clinics}
            hiddenIds={hiddenClinicIds}
            onToggle={toggleClinicCalendar}
            className={sidebarOpen ? "lg:hidden" : ""}
          />
          <div className="mt-2 flex items-center justify-between gap-2 md:hidden">
            <button
              type="button"
              onClick={() => shiftMobile(-1)}
              className={agendaNavIconButtonClass}
              aria-label={mobileView === "month" ? "Previous month" : "Previous day"}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-0 truncate text-sm font-semibold text-white">
              {mobileView === "month"
                ? agendaRangeTitle(anchorDate, "month")
                : format(anchorDate, "EEE, dd MMM", { locale: enGB })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToToday}
                className={`${agendaTodayChipButtonClass} px-2 py-1 text-[11px]`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => shiftMobile(1)}
                className={agendaNavIconButtonClass}
                aria-label={mobileView === "month" ? "Next month" : "Next day"}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex justify-center md:hidden">
            {renderViewSwitcher(["day", "month"], mobileView)}
          </div>
        </div>

        <div className="flex min-w-0">
          {sidebarOpen ? (
            <AgendaSidebar
              anchor={anchorDate}
              today={todayDate}
              rangeDays={view === "month" ? [] : gridDays}
              onPickDate={(date) => {
                setAnchorDate(startOfDay(date));
                if (view === "month") setView("day");
              }}
              onCreate={() => setManualBookingOpen(true)}
              pendingCount={pendingRows.length}
              clinics={clinics}
              hiddenClinicIds={hiddenClinicIds}
              onToggleClinic={toggleClinicCalendar}
            />
          ) : null}

          <div className="min-w-0 flex-1 px-3 pb-4 pt-2 sm:px-4 sm:pb-5">
            {view === "month" ? (
              <div>
                <AgendaMonthGrid
                  anchor={anchorDate}
                  today={todayDate}
                  itemsForDay={monthItemsForDay}
                  isWorkingDay={(date) => workingWindowsForDate(date).enabled}
                  onOpenDay={openDay}
                />
              </div>
            ) : null}

            {mobileView === "day" ? (
              <div className="md:hidden">
                {anchorRows.length === 0 && !anchorIsToday ? (
                  <p className="mb-2 text-center text-xs text-slate-400">
                    {isMultiClinic && visibleClinicIds.size === 0
                      ? "No calendars selected."
                      : "No appointments this day"}
                  </p>
                ) : null}
                <div className={`grid ${agendaDayGridColsClass}`}>
                  {renderHourAxis()}
                  {renderDayColumn(anchorDate, "mobile")}
                </div>
              </div>
            ) : null}

            {view !== "month" ? (
              <div className="hidden min-w-0 md:block">
                <div
                  className={`${agendaStickyWeekHeaderClass} overflow-hidden [scrollbar-gutter:stable] ${
                    view === "day" ? agendaDayGridColsClass : agendaWeekGridColsClass
                  }`}
                >
                  <div />
                  {gridDays.map((day) => {
                    const isTodayHeader = isSameDay(day, todayDate);
                    const working = workingWindowsForDate(day).enabled;
                    return (
                      <div
                        key={format(day, "yyyy-MM-dd")}
                        className={`${agendaDayHeaderShellClass} ${view === "day" ? "items-start pl-2" : ""} ${
                          working || isTodayHeader ? "" : "opacity-60"
                        }`}
                      >
                        <p className={agendaDayNameClass(isTodayHeader)}>
                          {format(day, "EEE", { locale: enGB })}
                        </p>
                        <button
                          type="button"
                          onClick={() => openDay(day)}
                          aria-label={`Open ${format(day, "EEEE d MMMM", { locale: enGB })}`}
                          className={`${agendaDayNumberClass(isTodayHeader)} transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70`}
                        >
                          {format(day, "d")}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div
                  ref={gridScrollRef}
                  data-testid="agenda-grid-scroll"
                  className="overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
                  style={gridScrollHeight != null ? { height: gridScrollHeight } : undefined}
                >
                  <div
                    className={`grid ${
                      view === "day" ? agendaDayGridColsClass : agendaWeekGridColsClass
                    }`}
                  >
                    {renderHourAxis()}
                    {gridDays.map((day) => renderDayColumn(day, "desktop"))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <ManualBookingFlow
        open={manualBookingOpen}
        doctorId={doctorId}
        doctorSlug={doctorSlug}
        appointments={appointments}
        workingHours={workingHours}
        clinics={clinics}
        preferredClinicId={[...visibleClinicIds][0] ?? clinics[0]?.id ?? null}
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
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-slate-400">
              <span>
                {selected.dateLabel} · {selected.timeLabel}
              </span>
              {clinicNameForRow(selected.location_id) ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-[2px] ${clinicSwatchClass(selected.location_id) ?? ""}`}
                    aria-hidden
                  />
                  {clinicNameForRow(selected.location_id)}
                </span>
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {selected.isExpired ? (
                <p className="inline-flex rounded-full border border-slate-600/80 bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                  Expired request
                </p>
              ) : selectedPast ? (
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
            {selected.isExpired && !confirmingCancel ? (
              <div className="mt-4" data-testid="agenda-expired-request">
                <p className="text-sm leading-relaxed text-slate-300">
                  This request expired: nobody answered it before the visit time. We let{" "}
                  {firstNameOf(selected.patient_name)} know they can book again online.
                </p>
              </div>
            ) : null}
            {selectedPast &&
            !selected.isExpired &&
            !confirmingCancel ? (
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
            !confirmingCancel ? (
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
              !confirmingCancel ? (
              <p className="mt-3 text-sm text-amber-200/90">
                Waiting for the patient to choose one of the proposed times.
              </p>
            ) : selectedStatus === "NEEDS_RESCHEDULE" &&
              !selectedProposalLive &&
              !confirmingCancel ? (
              <p className="mt-3 text-sm text-slate-400">
                The patient didn&apos;t choose a new time in time. Nothing is booked.
              </p>
            ) : null}
            {selectedStatus === "CONFIRMED" &&
            !selectedPast &&
            !confirmingCancel ? (
              <div className="mt-6 flex flex-col gap-2">
                {/* A confirmed visit can't be moved, only cancelled (user, 2026-10-04). */}
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
                    {selected &&
                    professionalCancelIsShortNotice(
                      selected.appointment_datetime,
                      patientCancelNoticeHours,
                    ) ? (
                      <p
                        className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-100"
                        data-testid="cancel-short-notice"
                      >
                        This is short notice for the patient: the visit is in less than{" "}
                        {patientCancelNoticeHours} hours.
                      </p>
                    ) : null}
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
