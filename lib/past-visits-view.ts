import { formatInTimeZone } from "date-fns-tz";
import { MANUAL_BOOKING_LABEL, isManualBooking } from "@/lib/agenda-booking-source";
import { CY_TZ } from "@/lib/appointments";
import { agendaClinicEventColor } from "@/lib/doctor-locations";
import { isSamePatient } from "@/lib/previous-visits";

/**
 * Pieces of the Visits tab's cards (user, 2026-10-12): the date tile, the time, the clinic
 * and the month headings. Cyprus time throughout.
 */
export function visitDateParts(iso: string): { day: string; month: string; weekday: string; time: string } {
  const d = new Date(iso);
  return {
    day: formatInTimeZone(d, CY_TZ, "d"),
    month: formatInTimeZone(d, CY_TZ, "MMM").toUpperCase(),
    weekday: formatInTimeZone(d, CY_TZ, "EEE"),
    time: formatInTimeZone(d, CY_TZ, "HH:mm"),
  };
}

/** "09:30–10:00" in Cyprus time; the start alone when the length is unknown. */
export function visitTimeRange(iso: string, durationMinutes: number | null | undefined): string {
  const start = new Date(iso);
  const from = formatInTimeZone(start, CY_TZ, "HH:mm");
  const minutes = Number(durationMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return from;
  return `${from}–${formatInTimeZone(new Date(start.getTime() + minutes * 60_000), CY_TZ, "HH:mm")}`;
}

/** How the visit was booked; null for older visits that carry no source. */
export function visitBookingLabel(source: string | null | undefined): string | null {
  if (isManualBooking(source)) return MANUAL_BOOKING_LABEL;
  return String(source ?? "").trim().toLowerCase() === "online" ? "Booked online" : null;
}

export type VisitClinicInfo = { name: string; swatch: string; former: boolean };

/** A clinic she no longer works at: no agenda colour of its own. */
export const FORMER_CLINIC_SWATCH = "bg-slate-500";

/**
 * The clinics of her visits by `clinics.id`. Her current clinics keep their agenda colour (their
 * place in `currentClinicIds`); one she has left keeps its name, in a neutral colour.
 */
export function visitClinicMap(
  names: Record<string, string>,
  currentClinicIds: readonly string[],
): Record<string, VisitClinicInfo> {
  const map: Record<string, VisitClinicInfo> = {};
  for (const [id, name] of Object.entries(names)) {
    const index = currentClinicIds.indexOf(id);
    map[id] = {
      name,
      swatch: index >= 0 ? agendaClinicEventColor(index).swatch : FORMER_CLINIC_SWATCH,
      former: index < 0,
    };
  }
  return map;
}

export type PastVisitFacetRow = {
  clinic_id: string | null;
  service_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
};

/** What the filters offer: the clinics and services that appear in her visits. */
export function pastVisitFacets(rows: readonly PastVisitFacetRow[]): { clinicIds: string[]; serviceNames: string[] } {
  const clinicIds = new Set<string>();
  const serviceNames = new Set<string>();
  for (const row of rows) {
    if (row.clinic_id) clinicIds.add(row.clinic_id);
    const service = row.service_name?.trim();
    if (service) serviceNames.add(service);
  }
  return { clinicIds: Array.from(clinicIds), serviceNames: Array.from(serviceNames).sort((a, b) => a.localeCompare(b)) };
}

/**
 * For each listed visit, how many past visits she has with that patient (this one included),
 * matched on email or phone like "All visits with this patient". No entry when there is
 * nothing to match on.
 */
export function patientVisitCounts(
  visits: readonly { id: string; patient_email: string | null; patient_phone: string | null }[],
  all: readonly PastVisitFacetRow[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const visit of visits) {
    const who = { email: visit.patient_email, phone: visit.patient_phone };
    const n = all.filter((row) => isSamePatient(row, who)).length;
    if (n > 0) counts[visit.id] = n;
  }
  return counts;
}

export type MonthGroup<T> = { key: string; label: string; visits: T[] };

/** Consecutive visits under their month (newest first in, newest first out). */
export function groupVisitsByMonth<T extends { appointment_datetime: string }>(visits: T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const visit of visits) {
    const d = new Date(visit.appointment_datetime);
    const key = formatInTimeZone(d, CY_TZ, "yyyy-MM");
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.visits.push(visit);
    } else {
      groups.push({ key, label: formatInTimeZone(d, CY_TZ, "MMMM yyyy"), visits: [visit] });
    }
  }
  return groups;
}
