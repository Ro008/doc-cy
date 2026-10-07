import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";

/** Lengths shown as one-tap chips on the review page; the rest sit under "Other". */
export const QUICK_DURATIONS = [15, 30, 45, 60] as const;

function clock(ms: number): string {
  return formatInTimeZone(new Date(ms), CY_TZ, "HH:mm");
}

/** "12:00–12:30" in Cyprus time for a visit starting at `startIso`. */
export function reviewTimeRangeLabel(startIso: string, durationMinutes: number): string {
  const start = new Date(startIso).getTime();
  return `${clock(start)}–${clock(start + durationMinutes * 60_000)}`;
}

export type ReviewBackTarget = { href: string; label: string };

/** Where "Back" goes: the dashboard when the doctor came from it, else the agenda. */
export function reviewBackTarget(from: string | null | undefined): ReviewBackTarget {
  return from === "dashboard"
    ? { href: "/dashboard", label: "Back to dashboard" }
    : { href: "/agenda", label: "Back to agenda" };
}

/** Where the page shown right after accepting goes; `from` keeps the way back. */
export function confirmedPath(appointmentId: string, from: string | null | undefined): string {
  const base = `/dashboard/appointments/${encodeURIComponent(appointmentId)}?confirmed=1`;
  return from === "dashboard" ? `${base}&from=dashboard` : base;
}

export type ConfirmedExitLinks = { primary: ReviewBackTarget; secondary: ReviewBackTarget };

/** The two ways out of the "visit confirmed" page: back where she came from, then the other place. */
export function confirmedExitLinks(
  from: string | null | undefined,
  day: { dateKey: string; label: string },
): ConfirmedExitLinks {
  const agendaHref = `/agenda?date=${day.dateKey}`;
  if (from === "dashboard") {
    return {
      primary: { href: "/dashboard", label: "Back to dashboard" },
      secondary: { href: agendaHref, label: `Open ${day.label} in agenda` },
    };
  }
  return {
    primary: { href: agendaHref, label: `Back to agenda (${day.label})` },
    secondary: { href: "/dashboard", label: "Go to dashboard" },
  };
}

/** Review page link from the dashboard; `suggest` opens it with three times ready. */
export function reviewPathFromDashboard(appointmentId: string, intent?: "suggest"): string {
  const params = new URLSearchParams();
  if (intent) params.set("intent", intent);
  params.set("from", "dashboard");
  return `/dashboard/appointments/${encodeURIComponent(appointmentId)}?${params.toString()}`;
}

export function wantsSuggestOnOpen(intent: string | null | undefined): boolean {
  return intent === "suggest";
}

export type ReviewDayRow = {
  id: string;
  appointment_datetime: string;
  patient_name: string | null;
  status: string | null;
  duration_minutes: number | null;
};

export type ReviewDayEntry = {
  id: string;
  patientName: string;
  rangeLabel: string;
  /** "request" for the one being reviewed; otherwise the visit's own state. */
  status: "request" | "confirmed" | "requested" | "proposal";
  isRequest: boolean;
  /** Overlaps the request at the chosen length (the request itself: overlaps anything). */
  overlaps: boolean;
};

const DEFAULT_DURATION = 30;

function entryStatus(raw: string | null): ReviewDayEntry["status"] | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "CONFIRMED") return "confirmed";
  if (s === "REQUESTED") return "requested";
  if (s === "NEEDS_RESCHEDULE") return "proposal";
  return null;
}

/**
 * The requested day around the request: other live visits that day plus the
 * request itself, in time order, with overlaps at the chosen length marked.
 */
export function buildReviewDayTimeline(
  dayRows: readonly ReviewDayRow[],
  request: { id: string; startIso: string; durationMinutes: number; patientName: string },
): ReviewDayEntry[] {
  const reqStart = new Date(request.startIso).getTime();
  const reqEnd = reqStart + request.durationMinutes * 60_000;

  const others = dayRows
    .filter((row) => row.id !== request.id)
    .map((row) => {
      const status = entryStatus(row.status);
      if (!status) return null;
      const start = new Date(row.appointment_datetime).getTime();
      const duration = row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : DEFAULT_DURATION;
      const end = start + duration * 60_000;
      const entry: ReviewDayEntry = {
        id: row.id,
        patientName: (row.patient_name ?? "").trim() || "Patient",
        rangeLabel: `${clock(start)}–${clock(end)}`,
        status,
        isRequest: false,
        overlaps: start < reqEnd && reqStart < end,
      };
      return { start, entry };
    })
    .filter((x): x is { start: number; entry: ReviewDayEntry } => x !== null);

  const requestEntry: ReviewDayEntry = {
    id: request.id,
    patientName: request.patientName,
    rangeLabel: `${clock(reqStart)}–${clock(reqEnd)}`,
    status: "request",
    isRequest: true,
    overlaps: others.some((o) => o.entry.overlaps),
  };

  return [...others, { start: reqStart, entry: requestEntry }]
    .sort((a, b) => a.start - b.start || (a.entry.isRequest ? 1 : -1))
    .map((x) => x.entry);
}
