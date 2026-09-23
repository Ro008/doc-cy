import type { DoctorLocationRow } from "@/lib/doctor-locations";

/**
 * Point D2: practice locations read from `professional_clinics -> clinics`.
 *
 * Stage 1 made the join row a per-(professional, clinic) row carrying the schedule,
 * and D1 keeps it an exact mirror of `doctor_locations` (same id). This maps it onto
 * the `DoctorLocationRow` every caller already renders, so profiles, agendas, emails,
 * the finder and the booking flow keep behaving identically while the read moves.
 *
 * The split of ownership is the point: the join row owns the schedule, pause, label
 * and ordering; the clinic owns the address, town, district and coordinates. Clinics
 * are admin-curated, which is why a professional edits the former and requests the
 * latter.
 */

export type ProfessionalClinicJoinClinic = {
  id?: string | null;
  name?: string | null;
  address?: string | null;
  district?: string | null;
  town?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  clinic_place_id?: string | null;
  is_archived?: boolean | null;
};

export type ProfessionalClinicJoinRow = {
  id?: string | null;
  professional_id?: string | null;
  is_primary?: boolean | null;
  sort_order?: number | null;
  label?: string | null;
  pause_online_bookings?: boolean | null;
  monday?: boolean | null;
  tuesday?: boolean | null;
  wednesday?: boolean | null;
  thursday?: boolean | null;
  friday?: boolean | null;
  saturday?: boolean | null;
  sunday?: boolean | null;
  start_time?: string | null;
  end_time?: string | null;
  weekly_schedule?: DoctorLocationRow["weekly_schedule"];
  break_start?: string | null;
  break_end?: string | null;
  slot_duration_minutes?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** PostgREST types an embed as an array; a to-one join still arrives as an object. */
  clinics?: ProfessionalClinicJoinClinic | ProfessionalClinicJoinClinic[] | null;
};

export const PROFESSIONAL_CLINIC_LOCATION_SELECT =
  "id, professional_id, is_primary, sort_order, label, pause_online_bookings, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, weekly_schedule, break_start, break_end, slot_duration_minutes, created_at, updated_at, clinics ( id, name, address, district, town, latitude, longitude, clinic_place_id, is_archived )";

function text(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * `null` when the row has no clinic, or an archived one: the same rule the manual
 * directory and the registered finder cards already apply, so a clinic that was
 * retired stops appearing as a place a patient can book.
 */
export function professionalClinicRowToLocation(
  row: ProfessionalClinicJoinRow,
): DoctorLocationRow | null {
  const clinic = Array.isArray(row.clinics) ? row.clinics[0] : row.clinics;
  if (!clinic || clinic.is_archived) return null;

  const slotMinutes = Number(row.slot_duration_minutes);

  return {
    id: String(row.id ?? ""),
    doctor_id: String(row.professional_id ?? ""),
    is_primary: Boolean(row.is_primary),
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    label: text(row.label),
    district: text(clinic.district),
    clinic_address: text(clinic.address),
    town: text(clinic.town),
    latitude: num(clinic.latitude),
    longitude: num(clinic.longitude),
    clinic_place_id: text(clinic.clinic_place_id),
    // A scraped listing has no schedule of its own. Defaults match the
    // doctor_locations column defaults, except that bookings stay paused: an
    // unconfigured clinic must never look open.
    pause_online_bookings: row.pause_online_bookings ?? true,
    monday: Boolean(row.monday),
    tuesday: Boolean(row.tuesday),
    wednesday: Boolean(row.wednesday),
    thursday: Boolean(row.thursday),
    friday: Boolean(row.friday),
    saturday: Boolean(row.saturday),
    sunday: Boolean(row.sunday),
    start_time: text(row.start_time) ?? "09:00:00",
    end_time: text(row.end_time) ?? "17:00:00",
    weekly_schedule: row.weekly_schedule ?? null,
    break_start: text(row.break_start),
    break_end: text(row.break_end),
    slot_duration_minutes: Number.isInteger(slotMinutes) && slotMinutes > 0 ? slotMinutes : 30,
    created_at: text(row.created_at) ?? undefined,
    updated_at: text(row.updated_at) ?? undefined,
  };
}
