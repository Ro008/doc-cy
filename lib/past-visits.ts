import type { SupabaseClient } from "@supabase/supabase-js";
import { zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";

/**
 * "Visits" tab (user, 2026-10-09): her past visits with the patient's details, the reason,
 * the service and her private notes, searchable, with the notes editable there. A past visit
 * is a CONFIRMED appointment that has started: the same rule that lets her write notes
 * (lib/professional-notes.ts), so every row listed here can be edited.
 */
export const PAST_VISITS_PATH = "/agenda/visits";
export const PAST_VISITS_PAGE_SIZE = 20;
const SEARCH_MAX = 100;

export const PAST_VISIT_SELECT =
  "id, patient_name, patient_email, patient_phone, patient_gender, patient_birthdate, is_new_patient, reason, service_name, appointment_datetime, duration_minutes, attendance, clinic_id, professional_notes";

export type PastVisitRow = {
  id: string;
  patient_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
  patient_gender: string | null;
  patient_birthdate: string | null;
  is_new_patient: boolean | null;
  reason: string | null;
  service_name: string | null;
  appointment_datetime: string;
  duration_minutes: number | null;
  attendance: string | null;
  clinic_id: string | null;
  professional_notes: string | null;
};

export type PastVisitsAttendance = "all" | "attended" | "no_show";

export type PastVisitsQuery = {
  q: string;
  /** Cyprus calendar days, YYYY-MM-DD, both included. */
  from: string | null;
  to: string | null;
  clinicId: string | null;
  /** Exact service name (the copy stored on the visit). */
  service: string | null;
  attendance: PastVisitsAttendance;
  page: number;
};

export function isPastVisit(
  row: { status: string | null | undefined; appointment_datetime: string },
  now: Date,
): boolean {
  if (String(row.status ?? "").trim().toUpperCase() !== "CONFIRMED") return false;
  const startMs = new Date(row.appointment_datetime).getTime();
  return Number.isFinite(startMs) && startMs <= now.getTime();
}

type RawParams = Record<string, string | string[] | undefined>;

function first(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

/** A real calendar day as YYYY-MM-DD, or null. */
function validDay(raw: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === raw ? raw : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePastVisitsParams(params: RawParams): PastVisitsQuery {
  let from = validDay(first(params.from));
  let to = validDay(first(params.to));
  if (from && to && from > to) [from, to] = [to, from];

  const clinic = first(params.clinic);
  const attendance = first(params.attendance);
  const page = Number.parseInt(first(params.page), 10);

  return {
    q: first(params.q).slice(0, SEARCH_MAX).trim(),
    from,
    to,
    clinicId: UUID.test(clinic) ? clinic : null,
    service: first(params.service).slice(0, 200) || null,
    attendance: attendance === "attended" || attendance === "no_show" ? attendance : "all",
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

/** UTC bounds for the Cyprus days: `fromIso` inclusive, `toIso` exclusive (the end day counts). */
export function pastVisitsDateBounds(
  from: string | null,
  to: string | null,
): { fromIso: string | null; toIso: string | null } {
  let toIso: string | null = null;
  if (to) {
    const next = new Date(`${to}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    toIso = zonedTimeToUtc(`${next.toISOString().slice(0, 10)}T00:00:00`, CY_TZ).toISOString();
  }
  return {
    fromIso: from ? zonedTimeToUtc(`${from}T00:00:00`, CY_TZ).toISOString() : null,
    toIso,
  };
}

/** A value inside PostgREST double quotes: backslash-escape `\` and `"`. */
function quoted(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/**
 * PostgREST `or` filter for the search box: the text anywhere in the patient's name or email,
 * the reason, the service or her notes; and, when it looks like a phone number, the phone with
 * any spacing. Everything stays inside quotes, so the text can't add a filter of its own.
 */
export function pastVisitsSearchFilter(raw: string): string | null {
  const text = raw.trim().slice(0, SEARCH_MAX);
  if (!text) return null;
  const like = quoted(`%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const parts = ["patient_name", "patient_email", "reason", "service_name", "professional_notes"].map(
    (column) => `${column}.ilike.${like}`,
  );
  const digits = text.replace(/\D/g, "");
  if (/^[\d\s+()-]+$/.test(text) && digits.length >= 4) {
    parts.push(`patient_phone.match.${quoted(digits.split("").join(String.raw`\D*`))}`);
  }
  return parts.join(",");
}

export function pastVisitsPageRange(page: number): { from: number; to: number } {
  const from = (Math.max(1, page) - 1) * PAST_VISITS_PAGE_SIZE;
  return { from, to: from + PAST_VISITS_PAGE_SIZE - 1 };
}

/** The tab's URL for these filters, leaving out what is at its default. */
export function pastVisitsHref(query: PastVisitsQuery, overrides: Partial<PastVisitsQuery> = {}): string {
  const q = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (q.q) params.set("q", q.q);
  if (q.from) params.set("from", q.from);
  if (q.to) params.set("to", q.to);
  if (q.clinicId) params.set("clinic", q.clinicId);
  if (q.service) params.set("service", q.service);
  if (q.attendance !== "all") params.set("attendance", q.attendance);
  if (q.page > 1) params.set("page", String(q.page));
  const qs = params.toString();
  return qs ? `${PAST_VISITS_PATH}?${qs}` : PAST_VISITS_PATH;
}

export async function loadPastVisits(
  supabase: SupabaseClient,
  input: { professionalId: string; query: PastVisitsQuery; now?: Date },
): Promise<{ rows: PastVisitRow[]; total: number; failed: boolean }> {
  const { query } = input;
  const now = input.now ?? new Date();
  const { fromIso, toIso } = pastVisitsDateBounds(query.from, query.to);
  const range = pastVisitsPageRange(query.page);

  let req = supabase
    .from("appointments")
    .select(PAST_VISIT_SELECT, { count: "exact" })
    .eq("professional_id", input.professionalId)
    .eq("status", "CONFIRMED")
    .lte("appointment_datetime", now.toISOString());
  if (fromIso) req = req.gte("appointment_datetime", fromIso);
  if (toIso) req = req.lt("appointment_datetime", toIso);
  if (query.clinicId) req = req.eq("clinic_id", query.clinicId);
  if (query.service) req = req.eq("service_name", query.service);
  if (query.attendance === "no_show") req = req.eq("attendance", "no_show");
  // Attendance is filled in by a job after the visit, so "attended" also means not marked yet.
  if (query.attendance === "attended") req = req.or("attendance.is.null,attendance.neq.no_show");
  const search = pastVisitsSearchFilter(query.q);
  if (search) req = req.or(search);

  const { data, count, error } = await req
    .order("appointment_datetime", { ascending: false })
    .range(range.from, range.to);
  if (error) {
    console.error("[DocCy] loadPastVisits failed", error);
    return { rows: [], total: 0, failed: true };
  }
  return { rows: (data ?? []) as PastVisitRow[], total: count ?? 0, failed: false };
}
