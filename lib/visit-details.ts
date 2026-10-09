import { formatInTimeZone } from "date-fns-tz";
import { enGB } from "date-fns/locale";
import { appointmentTimeLabelCyprus, CY_TZ } from "@/lib/appointments";
import { isExpiredRequest } from "@/lib/appointment-status";

/** An appointment as the agenda and the visit details window read it (AGENDA_APPOINTMENT_SELECT). */
export type AgendaAppointmentRow = {
  id: string;
  professional_id: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string | null;
  patient_gender?: string | null;
  patient_birthdate?: string | null;
  is_new_patient?: boolean | null;
  reason?: string | null;
  appointment_datetime: string;
  status?: string | null;
  duration_minutes?: number | null;
  proposed_slots?: unknown;
  proposal_expires_at?: string | null;
  attendance?: string | null;
  clinic_id?: string | null;
  professional_notes?: string | null;
  review_requested_at?: string | null;
  booking_source?: string | null;
};

/** What the visit details window shows on top of the row (the agenda adds more for its grid). */
export type VisitDetails = AgendaAppointmentRow & {
  /** Start shown for the visit: a proposed time for a counter-offer hold, else the visit's own. */
  gridStartIso: string;
  isCounterOfferHold: boolean;
  dateLabel: string;
  timeLabel: string;
  rowDurationMinutes: number;
  isExpired: boolean;
  showReviewLink: boolean;
};

const DEFAULT_VISIT_MINUTES = 30;

/** The window's view of one visit outside the agenda grid (the dashboard's today list). */
export function visitDetailsFromRow(row: AgendaAppointmentRow, nowMs: number): VisitDetails {
  const startIso = row.appointment_datetime;
  const status = String(row.status ?? "").toUpperCase();
  const isExpired = isExpiredRequest({ status, startIso }, nowMs);
  const minutes = Number(row.duration_minutes);
  return {
    ...row,
    gridStartIso: startIso,
    isCounterOfferHold: false,
    dateLabel: formatInTimeZone(new Date(startIso), CY_TZ, "dd/MM/yyyy", { locale: enGB }),
    timeLabel: appointmentTimeLabelCyprus(startIso),
    rowDurationMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_VISIT_MINUTES,
    isExpired,
    showReviewLink: status === "REQUESTED" && !isExpired,
  };
}
