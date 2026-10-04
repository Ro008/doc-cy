import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addHours, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

import { candidateOverlapsAnyBlockingInterval, explainCandidateOverlap } from "@/lib/appointment-overlap";
import { fetchBlockingAppointments, toBlockingRows } from "@/lib/appointment-blocking-query";
import { CY_TZ } from "@/lib/appointments";
import { onlineBookingPermission, type BookingRefusal } from "@/lib/booking-permission";
import {
  buildWeeklyScheduleFromSettings,
  isDateInHolidayRange,
  isTimeWithinSettings,
  normalizeMinimumNoticeHours,
} from "@/lib/doctor-settings";
import { locationToSettingsRow, type DoctorLocationRow } from "@/lib/doctor-locations";
import { loadDoctorLocations, primaryDoctorLocation } from "@/lib/load-doctor-locations";
import { PROFESSIONAL_ACCOUNT_SETTINGS_SELECT } from "@/lib/professional-account-settings";
import { locationHasClinic } from "@/lib/professional-clinic-locations";

/**
 * Everything an online booking must pass, run when the patient submits the form and
 * again when they confirm the emailed link (someone may have taken the time since).
 * Who can be booked: lib/booking-permission.ts. One agenda per professional: overlap is
 * checked against her visits in every clinic.
 */

export type SlotRefusalCode =
  | BookingRefusal
  | "not_found"
  | "no_settings"
  | "choose_clinic"
  | "no_clinic"
  | "invalid_time"
  | "holiday"
  | "beyond_horizon"
  | "minimum_notice"
  | "outside_hours"
  | "not_aligned"
  | "slot_taken"
  | "server_error";

// Each branch lists the other's fields as optional `undefined`: the project compiles without
// strictNullChecks, where a boolean discriminant doesn't narrow.
export type SlotCheckResult =
  | {
      ok: true;
      appointmentUtc: Date;
      bookingLocation: DoctorLocationRow;
      locations: DoctorLocationRow[];
      slotDurationMinutes: number;
      status?: undefined;
      code?: undefined;
      message?: undefined;
      debug?: undefined;
    }
  | {
      ok: false;
      status: number;
      code: SlotRefusalCode;
      message: string;
      debug?: unknown;
      appointmentUtc?: undefined;
      bookingLocation?: undefined;
      locations?: undefined;
      slotDurationMinutes?: undefined;
    };

export type SlotCheckInput = {
  professionalId: string;
  /** "YYYY-MM-DDTHH:mm", Cyprus wall clock. */
  appointmentLocal: string;
  /** professional_clinics id the patient picked; optional with one clinic. */
  locationId?: string | null;
  /** clinics id (a draft stores the clinic): must be one of her clinics. Wins over locationId. */
  clinicId?: string | null;
};

const UNAVAILABLE = "Bookings temporarily unavailable";
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function refuse(status: number, code: SlotRefusalCode, message: string, debug?: unknown): SlotCheckResult {
  return debug === undefined ? { ok: false, status, code, message } : { ok: false, status, code, message, debug };
}

const PERMISSION_MESSAGES: Record<BookingRefusal, string> = {
  not_registered: "This professional is not accepting public bookings yet.",
  access_expired: "This professional is not accepting online bookings right now.",
  clinic_archived: UNAVAILABLE,
  clinic_paused: UNAVAILABLE,
};

export async function checkOnlineBookingSlot(
  supabase: SupabaseClient,
  input: SlotCheckInput,
  opts: { now?: Date; loadLocations?: (professionalId: string) => Promise<DoctorLocationRow[]> } = {},
): Promise<SlotCheckResult> {
  const now = opts.now ?? new Date();
  const loadLocations = opts.loadLocations ?? loadDoctorLocations;
  const professionalId = String(input.professionalId ?? "").trim();
  if (!professionalId) return refuse(400, "not_found", "Professional not found.");

  const { data: professional, error: professionalError } = await supabase
    .from("professionals")
    .select("id, is_registered, pro_access_until")
    .eq("id", professionalId)
    .single();
  if (professionalError || !professional) return refuse(400, "not_found", "Professional not found.");
  // Unregistered listings first, before anything about their (absent) schedule.
  if (!(professional as { is_registered?: boolean }).is_registered) {
    return refuse(403, "not_registered", PERMISSION_MESSAGES.not_registered);
  }

  let appointmentUtc: Date;
  try {
    appointmentUtc = zonedTimeToUtc(String(input.appointmentLocal ?? ""), CY_TZ);
  } catch {
    return refuse(400, "invalid_time", "Invalid appointmentLocal value.");
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(input.appointmentLocal ?? "")) || Number.isNaN(appointmentUtc.getTime())) {
    return refuse(400, "invalid_time", "Invalid appointmentLocal value.");
  }

  const { data: settings, error: settingsError } = await supabase
    .from("professional_settings")
    .select(PROFESSIONAL_ACCOUNT_SETTINGS_SELECT)
    .eq("professional_id", professionalId)
    .single();
  if (settingsError || !settings) {
    if ((settingsError as { code?: string } | null)?.code === "PGRST116") {
      return refuse(400, "no_settings", "Professional has not set availability yet.");
    }
    console.error("[DocCy] slot check: settings", settingsError);
    return refuse(500, "server_error", "Error checking availability.");
  }

  const locations = await loadLocations(professionalId);
  const requestedClinicId = String(input.clinicId ?? "").trim();
  const requestedLocationId = String(input.locationId ?? "").trim();
  const bookingLocation = requestedClinicId
    ? locations.find((row) => row.clinic_id === requestedClinicId) ?? null
    : (requestedLocationId ? locations.find((row) => row.id === requestedLocationId) : null) ??
      (locations.length === 1 ? locations[0] : null) ??
      primaryDoctorLocation(locations);
  if (!requestedClinicId && locations.length > 1 && !bookingLocation) {
    return refuse(400, "choose_clinic", "Please choose a clinic for this appointment.");
  }
  // Every appointment is at a clinic with an address (user 2026-09-29).
  if (!bookingLocation || !locationHasClinic(bookingLocation)) {
    return refuse(403, "no_clinic", UNAVAILABLE);
  }

  const permission = onlineBookingPermission(
    {
      isRegistered: Boolean((professional as { is_registered?: boolean }).is_registered),
      proAccessUntil: (professional as { pro_access_until?: string | null }).pro_access_until ?? null,
      clinicPaused: Boolean(bookingLocation.pause_online_bookings),
      // loadDoctorLocations leaves archived clinics out, so a location here is unarchived.
      clinicArchived: false,
    },
    now,
  );
  if (!permission.allowed) {
    return refuse(403, permission.reason, PERMISSION_MESSAGES[permission.reason]);
  }

  // The schedule is the clinic link's; holiday, horizon and notice are the account's.
  const locationSettings = locationToSettingsRow(bookingLocation, settings as never);
  const cyLocal = utcToZonedTime(appointmentUtc, CY_TZ);
  const dateKey = format(cyLocal, "yyyy-MM-dd");

  if (isDateInHolidayRange(locationSettings, dateKey)) return refuse(403, "holiday", UNAVAILABLE);

  const horizonDays = Number(locationSettings.booking_horizon_days ?? 90);
  const maxHorizonDays = [14, 30, 90, 180].includes(horizonDays) ? horizonDays : 90;
  const maxDateKey = format(addDays(utcToZonedTime(now, CY_TZ), maxHorizonDays), "yyyy-MM-dd");
  if (dateKey > maxDateKey) {
    return refuse(400, "beyond_horizon", "Requested time is outside the professional's booking horizon.");
  }

  const noticeHours = normalizeMinimumNoticeHours(locationSettings.minimum_notice_hours);
  if (appointmentUtc.getTime() < addHours(now, noticeHours).getTime()) {
    return refuse(400, "minimum_notice", "Requested time does not meet the minimum notice period.");
  }

  const dayOfWeek = cyLocal.getDay();
  const hours = cyLocal.getHours();
  const minutes = cyLocal.getMinutes();
  const hhmmss = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  if (!isTimeWithinSettings(locationSettings, dayOfWeek, hhmmss)) {
    return refuse(400, "outside_hours", "Requested time is outside the professional's availability.");
  }

  const rawSlot = Number(locationSettings.slot_duration_minutes ?? 30);
  const slotDurationMinutes = Number.isFinite(rawSlot) && rawSlot > 0 ? rawSlot : 30;

  // Slot grid alignment (protects against malformed clients).
  const dayStartRaw = buildWeeklyScheduleFromSettings(locationSettings)[DAY_KEYS[dayOfWeek]]?.start_time ?? "09:00:00";
  const [startHour, startMinute] = dayStartRaw.split(":").map(Number);
  if ((hours * 60 + minutes - (startHour * 60 + startMinute)) % slotDurationMinutes !== 0) {
    return refuse(400, "not_aligned", "Requested time is not aligned with the professional's slot duration.");
  }

  const { data: blockingRaw, error: blockingError } = await fetchBlockingAppointments(supabase, professionalId);
  if (blockingError) {
    console.error("[DocCy] slot check: blocking", blockingError);
    return refuse(500, "server_error", "Error checking existing appointments.");
  }
  const startIso = appointmentUtc.toISOString();
  const rows = toBlockingRows(blockingRaw);
  if (candidateOverlapsAnyBlockingInterval(startIso, slotDurationMinutes, null, rows, slotDurationMinutes, now.getTime())) {
    const debug =
      process.env.NODE_ENV !== "production"
        ? explainCandidateOverlap(startIso, slotDurationMinutes, null, rows, slotDurationMinutes)
        : undefined;
    return refuse(409, "slot_taken", "That time was just booked. Please choose another time.", debug ?? undefined);
  }

  return { ok: true, appointmentUtc, bookingLocation, locations, slotDurationMinutes };
}
