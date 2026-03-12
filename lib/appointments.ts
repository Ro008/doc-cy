// lib/appointments.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { zonedTimeToUtc, utcToZonedTime } from "date-fns-tz";

export const CY_TZ = "Europe/Nicosia";

export type AppointmentRow = {
  id: string;
  doctor_id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  appointment_datetime: string; // UTC ISO (timestamptz)
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
};

/**
 * Obtiene las citas de un doctor para un día concreto en horario local de Chipre.
 *
 * @param supabase SupabaseClient ya inicializado
 * @param doctorId ID del doctor
 * @param localDate Fecha local en formato "YYYY-MM-DD" (Europe/Nicosia)
 */
export async function getAppointmentsForDate(
  supabase: SupabaseClient,
  doctorId: string,
  localDate: string
): Promise<AppointmentRow[]> {
  // Construimos inicio y fin de día en zona Europe/Nicosia,
  // y luego los convertimos a UTC para la query.
  const dayStartLocal = `${localDate}T00:00:00`;
  const dayEndLocal = `${localDate}T23:59:59.999`;

  const dayStartUtc = zonedTimeToUtc(dayStartLocal, CY_TZ);
  const dayEndUtc = zonedTimeToUtc(dayEndLocal, CY_TZ);

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, patient_name, patient_phone, patient_email, appointment_datetime, status, created_at"
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
 * Helper para convertir un ISO UTC (appointment_datetime) a Date en zona Chipre.
 */
export function appointmentToCyprusDate(utcIso: string): Date {
  const utcDate = new Date(utcIso);
  return utcToZonedTime(utcDate, CY_TZ);
}

