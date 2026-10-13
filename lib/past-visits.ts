import type { SupabaseClient } from "@supabase/supabase-js";
import { zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { previousVisitsOrFilter } from "@/lib/previous-visits";

/**
 * "Visits" tab (user, 2026-10-09): her past visits with the patient's details, the reason,
 * the service and her private notes, searchable, with the notes editable there. A past visit
 * is a CONFIRMED appointment that has started: the same rule that lets her write notes
 * (lib/professional-notes.ts), so every row listed here can be edited.
 */
export const PAST_VISITS_PATH = "/agenda/visits";
export const PAST_VISITS_PAGE_SIZE = 20;
/** 10,000 visits: far past any real practice, so a hostile `page` never reaches the database. */
export const PAST_VISITS_MAX_PAGE = 500;
const SEARCH_MAX = 100;

export const PAST_VISIT_SELECT =
  "id, patient_name, patient_email, patient_phone, patient_gender, patient_birthdate, is_new_patient, reason, service_name, appointment_datetime, duration_minutes, attendance, clinic_id, professional_notes, booking_source";

export type PastVisitRow = {
  booking_source?: string | null;
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
  /** "missing": only visits she hasn't written notes for yet. */
  notes: "all" | "missing";
  /**
   * Only the visits of the patient of this visit of hers (matched on its email or phone, on the
   * server). An id, never the email or phone itself: those would sit in the URL.
   */
  patientId: string | null;
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
    notes: first(params.notes) === "missing" ? "missing" : "all",
    patientId: UUID.test(first(params.patient)) ? first(params.patient) : null,
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, PAST_VISITS_MAX_PAGE) : 1,
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
  if (q.notes === "missing") params.set("notes", "missing");
  if (q.patientId) params.set("patient", q.patientId);
  if (q.page > 1) params.set("page", String(q.page));
  const qs = params.toString();
  return qs ? `${PAST_VISITS_PATH}?${qs}` : PAST_VISITS_PATH;
}

export async function loadPastVisits(
  supabase: SupabaseClient,
  input: { professionalId: string; query: PastVisitsQuery; now?: Date },
): Promise<{
  rows: PastVisitRow[];
  total: number;
  failed: boolean;
  patientName: string | null;
  /** The page actually served: the first one when the asked page doesn't exist. */
  page: number;
}> {
  const { query } = input;
  const now = input.now ?? new Date();
  const { fromIso, toIso } = pastVisitsDateBounds(query.from, query.to);
  const range = pastVisitsPageRange(query.page);

  // The patient filter: look the visit up (hers only) and match on its email or phone.
  let patientFilter: string | null = null;
  let patientName: string | null = null;
  if (query.patientId) {
    const { data: who } = await supabase
      .from("appointments")
      .select("patient_name, patient_email, patient_phone")
      .eq("id", query.patientId)
      .eq("professional_id", input.professionalId)
      .maybeSingle();
    patientFilter = who ? previousVisitsOrFilter({ email: who.patient_email, phone: who.patient_phone }) : null;
    // Not hers, or nothing to match on: no visits (and nothing said about why).
    if (!patientFilter) return { rows: [], total: 0, failed: false, patientName: null, page: query.page };
    patientName = String(who?.patient_name ?? "").trim() || null;
  }

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
  if (query.notes === "missing") req = req.is("professional_notes", null);
  if (patientFilter) req = req.or(patientFilter);
  const search = pastVisitsSearchFilter(query.q);
  if (search) req = req.or(search);

  const { data, count, error } = await req
    .order("appointment_datetime", { ascending: false })
    .range(range.from, range.to);
  if (error) {
    // PGRST103: the page is past the last one (visits were removed, or a made-up number).
    if (error.code === "PGRST103" && query.page > 1) {
      return loadPastVisits(supabase, { ...input, query: { ...query, page: 1 } });
    }
    console.error("[DocCy] loadPastVisits failed", error.code ?? "unknown");
    return { rows: [], total: 0, failed: true, patientName, page: query.page };
  }
  return { rows: (data ?? []) as PastVisitRow[], total: count ?? 0, failed: false, patientName, page: query.page };
}

/**
 * The tab showing this patient's visits. The link carries the id of the visit, not the patient's
 * email or phone (those would end up in the URL: browser history, server logs, analytics); the
 * server looks the visit up and matches on its email or phone. A likely match, like the previous
 * visits, since there is no patient record yet.
 *
 * PATIENT-ACCOUNTS: when patients get accounts (a `patients` table and `appointments.patient_id`),
 * this becomes exact: link with `?patient=<patient id>`, filter `loadPastVisits` by `patient_id`, and drop
 * the email/phone matching. Same change as lib/previous-visits.ts; `grep -rn PATIENT-ACCOUNTS`.
 */
export function patientVisitsHref(row: {
  id: string;
  patient_email: string | null;
  patient_phone: string | null;
}): string | null {
  const hasEmail = String(row.patient_email ?? "").includes("@");
  const hasPhone = String(row.patient_phone ?? "").replace(/\D/g, "").length >= 8;
  if (!hasEmail && !hasPhone) return null;
  return pastVisitsHref(parsePastVisitsParams({}), { patientId: row.id });
}

/** How many of her past visits have no notes yet (every filter ignored). */
export async function countPastVisitsWithoutNotes(
  supabase: SupabaseClient,
  professionalId: string,
  now: Date = new Date(),
): Promise<number> {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", professionalId)
    .eq("status", "CONFIRMED")
    .lte("appointment_datetime", now.toISOString())
    .is("professional_notes", null);
  if (error) {
    console.error("[DocCy] countPastVisitsWithoutNotes failed", error);
    return 0;
  }
  return count ?? 0;
}
