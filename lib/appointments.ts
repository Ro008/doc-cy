// lib/appointments.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone, zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";

export const CY_TZ = "Europe/Nicosia";

export type AppointmentRow = {
  id: string;
  doctor_id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  appointment_datetime: string; // UTC ISO (timestamptz)
  status: "REQUESTED" | "CONFIRMED" | "CANCELLED";
  reason?: string | null;
  created_at: string;
};

/**
 * Fetches a doctor's appointments for one calendar day in Europe/Nicosia local time.
 *
 * @param supabase Initialized Supabase client
 * @param doctorId Doctor id
 * @param localDate Local date as "YYYY-MM-DD" (Europe/Nicosia)
 */
export async function getAppointmentsForDate(
  supabase: SupabaseClient,
  doctorId: string,
  localDate: string
): Promise<AppointmentRow[]> {
  // Build day start/end in Europe/Nicosia, then convert to UTC for the query.
  const dayStartLocal = `${localDate}T00:00:00`;
  const dayEndLocal = `${localDate}T23:59:59.999`;

  const dayStartUtc = zonedTimeToUtc(dayStartLocal, CY_TZ);
  const dayEndUtc = zonedTimeToUtc(dayEndLocal, CY_TZ);

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, patient_phone, patient_email, appointment_datetime, status, reason, created_at"
    )
    .eq("doctor_id", doctorId)
    .gte("appointment_datetime", dayStartUtc.toISOString())
    .lte("appointment_datetime", dayEndUtc.toISOString())
    .order("appointment_datetime", { ascending: true });

  if (error) {
    console.error("Error fetching appointments for date", {
      error,
      doctorId,
      localDate,
    });
    return [];
  }

  return (data ?? []) as AppointmentRow[];
}

/**
 * Converts a UTC ISO `appointment_datetime` to a Date interpreted for Cyprus wall-clock helpers.
 */
export function appointmentToCyprusDate(utcIso: string): Date {
  const utcDate = new Date(utcIso);
  return utcToZonedTime(utcDate, CY_TZ);
}

/**
 * Agenda grid position in minutes from `startHour` (e.g. 8), using Europe/Nicosia wall time.
 * Do not use `getHours()` on `utcToZonedTime` — that follows the browser timezone, not Cyprus.
 */
export function appointmentMinutesFromAgendaStart(
  utcIso: string,
  startHour: number
): number {
  const d = new Date(utcIso);
  const hour = Number(formatInTimeZone(d, CY_TZ, "H"));
  const minute = Number(formatInTimeZone(d, CY_TZ, "m"));
  return (hour - startHour) * 60 + minute;
}

export function appointmentDateKeyCyprus(utcIso: string): string {
  return formatInTimeZone(new Date(utcIso), CY_TZ, "yyyy-MM-dd");
}

export function appointmentTimeLabelCyprus(utcIso: string): string {
  return formatInTimeZone(new Date(utcIso), CY_TZ, "HH:mm");
}

