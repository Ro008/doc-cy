import type { DoctorWorkplaceFormData } from "@/components/dashboard/SettingsForm";
import { locationWeeklySchedule, type DoctorLocationRow } from "@/lib/doctor-locations";

/** One of her clinics as the Settings form holds it (the page, and a clinic just joined). */
export function settingsWorkplaceFromLocation(row: DoctorLocationRow): DoctorWorkplaceFormData {
  return {
    id: row.id,
    label: String(row.label ?? "").trim(),
    district: String(row.district ?? "").trim(),
    clinicAddress: String(row.clinic_address ?? "").trim(),
    clinicTown: String(row.town ?? "").trim() || null,
    clinicLatitude: row.latitude ?? null,
    clinicLongitude: row.longitude ?? null,
    clinicPlaceId: row.clinic_place_id ?? null,
    weeklySchedule: locationWeeklySchedule(row),
    slotDurationMinutes: Number(row.slot_duration_minutes) > 0 ? Number(row.slot_duration_minutes) : 30,
    pauseOnlineBookings: Boolean(row.pause_online_bookings),
  };
}
