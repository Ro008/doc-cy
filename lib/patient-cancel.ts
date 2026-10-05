import type { SupabaseClient } from "@supabase/supabase-js";

import { appointmentLinkState, findAppointmentLink, type AppointmentLinkRow } from "@/lib/appointment-links-db";
import { isAppointmentLinkTokenShape } from "@/lib/appointment-link-token";
import { clinicMapsUrl } from "@/lib/clinic-info";
import { parsePatientCancelNoticeHours, patientCanCancel } from "@/lib/patient-cancel-window";

/**
 * Everything the patient's cancel page and POST /api/booking/cancel need from the
 * emailed link (user, 2026-10-04): the visit, the professional, the clinic (its phone
 * for late cancellations) and whether online cancellation is still open.
 */

export type PatientCancelContext =
  | { kind: "invalid" | "used" }
  | {
      kind: "visit";
      link: AppointmentLinkRow;
      linkUsable: boolean;
      appointment: {
        id: string;
        professional_id: string;
        appointment_datetime: string;
        status: string;
        patient_name: string;
      };
      professional: { name: string; slug: string | null; email: string | null; registration_email: string | null };
      clinic: { name: string; address: string | null; phone: string | null; mapsUrl: string | null };
      noticeHours: number;
      /** Confirmed, link usable and before the notice deadline. */
      canCancel: boolean;
      /** Confirmed but past the deadline: show the clinic phone. */
      windowClosed: boolean;
    };

export async function loadPatientCancelContext(
  service: SupabaseClient,
  token: unknown,
  now: Date = new Date(),
): Promise<PatientCancelContext> {
  if (!isAppointmentLinkTokenShape(token)) return { kind: "invalid" };
  const link = await findAppointmentLink(service, token, "cancel");
  const state = appointmentLinkState(link, now);
  if (!link || state === "invalid") return { kind: "invalid" };
  if (state === "used") return { kind: "used" };

  const { data: appt } = await service
    .from("appointments")
    .select("id, professional_id, appointment_datetime, status, patient_name, clinic_id")
    .eq("id", link.appointment_id)
    .maybeSingle();
  if (!appt) return { kind: "invalid" };
  const a = appt as {
    id: string;
    professional_id: string;
    appointment_datetime: string;
    status: string;
    patient_name: string;
    clinic_id: string | null;
  };

  const [{ data: pro }, { data: clinic }, { data: settings }] = await Promise.all([
    service.from("professionals").select("name, slug, email, registration_email").eq("id", a.professional_id).maybeSingle(),
    a.clinic_id
      ? service.from("clinics").select("name, address, phone, address_maps_link, latitude, longitude").eq("id", a.clinic_id).maybeSingle()
      : Promise.resolve({ data: null }),
    service
      .from("professional_settings")
      .select("patient_cancel_notice_hours")
      .eq("professional_id", a.professional_id)
      .maybeSingle(),
  ]);
  const noticeHours = parsePatientCancelNoticeHours(
    (settings as { patient_cancel_notice_hours?: number } | null)?.patient_cancel_notice_hours,
  );
  const confirmed = String(a.status).toUpperCase() === "CONFIRMED";
  const linkUsable = state === "usable";
  const beforeDeadline = patientCanCancel(a.appointment_datetime, noticeHours, now);
  const c = clinic as {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    address_maps_link?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  const p = (pro ?? {}) as { name?: string; slug?: string | null; email?: string | null; registration_email?: string | null };

  return {
    kind: "visit",
    link,
    linkUsable,
    appointment: a,
    professional: {
      name: String(p.name ?? "your professional"),
      slug: p.slug ?? null,
      email: p.email ?? null,
      registration_email: p.registration_email ?? null,
    },
    clinic: {
      name: String(c?.name ?? "the clinic"),
      address: c?.address ?? null,
      phone: c?.phone ?? null,
      mapsUrl: clinicMapsUrl({
        mapsLink: c?.address_maps_link,
        latitude: c?.latitude,
        longitude: c?.longitude,
        address: c?.address,
      }),
    },
    noticeHours,
    canCancel: confirmed && linkUsable && beforeDeadline,
    windowClosed: confirmed && !beforeDeadline,
  };
}
