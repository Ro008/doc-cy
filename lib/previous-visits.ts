import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Previous visits with you" on a new request (user, 2026-10-04): her past confirmed visits
 * with the same patient, matched on email or phone. A suggestion until patient accounts
 * exist (then exact on patient_id). Shows her private notes, so only she ever sees it.
 */
export type PreviousVisitRow = {
  id: string;
  appointment_datetime: string;
  patient_email: string | null;
  patient_phone: string | null;
  attendance: string | null;
  professional_notes: string | null;
  location_id: string | null;
};

const PREVIOUS_VISIT_SELECT =
  "id, appointment_datetime, patient_email, patient_phone, attendance, professional_notes, location_id";

type Who = { email: string | null | undefined; phone: string | null | undefined };

function emailKey(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return s.includes("@") ? s : null;
}

/** Last 8 digits (Cyprus numbers), so "+357 99 444555" and "99444555" match. */
export function phoneKey(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : null;
}

export function isSamePatient(
  row: { patient_email: string | null; patient_phone: string | null },
  who: Who,
): boolean {
  const email = emailKey(who.email);
  const phone = phoneKey(who.phone);
  if (email && emailKey(row.patient_email) === email) return true;
  if (phone && phoneKey(row.patient_phone) === phone) return true;
  return false;
}

/** A value inside PostgREST double quotes: backslash-escape `\` and `"`. */
function quoted(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/** Coarse SQL filter; isSamePatient decides exactly. */
export function previousVisitsOrFilter(who: Who): string | null {
  const parts: string[] = [];
  const email = emailKey(who.email);
  if (email) parts.push(`patient_email.ilike.${quoted(email.replace(/[\\%_]/g, (c) => `\\${c}`))}`);
  const phone = phoneKey(who.phone);
  if (phone) {
    // The 8 digits with any separators between them ("+357 99 444 555"), ending the number.
    const sep = String.raw`\D*`;
    parts.push(`patient_phone.match.${quoted(phone.split("").join(sep) + sep + "$")}`);
  }
  return parts.length ? parts.join(",") : null;
}

export function selectPreviousVisits<T extends PreviousVisitRow>(rows: T[], who: Who, limit: number): T[] {
  return rows
    .filter((r) => isSamePatient(r, who))
    .sort((a, b) => new Date(b.appointment_datetime).getTime() - new Date(a.appointment_datetime).getTime())
    .slice(0, limit);
}

export async function loadPreviousVisits(
  supabase: SupabaseClient,
  input: { professionalId: string; appointmentId: string; email: string | null; phone: string | null; now?: Date },
  limit = 5,
): Promise<PreviousVisitRow[]> {
  const filter = previousVisitsOrFilter(input);
  if (!filter) return [];
  const { data, error } = await supabase
    .from("appointments")
    .select(PREVIOUS_VISIT_SELECT)
    .eq("professional_id", input.professionalId)
    .eq("status", "CONFIRMED")
    .neq("id", input.appointmentId)
    .lt("appointment_datetime", (input.now ?? new Date()).toISOString())
    .or(filter)
    .order("appointment_datetime", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[DocCy] loadPreviousVisits failed", error);
    return [];
  }
  return selectPreviousVisits((data ?? []) as PreviousVisitRow[], input, limit);
}
