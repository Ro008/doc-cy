import type { SupabaseClient } from "@supabase/supabase-js";

import { appointmentLinkState, findAppointmentLink, type AppointmentLinkRow } from "@/lib/appointment-links-db";
import { isAppointmentLinkTokenShape } from "@/lib/appointment-link-token";
import { reviewEligibility } from "@/lib/professional-review";

/**
 * What the review page and POST /api/booking/review need from the emailed link
 * (user, 2026-10-04): the visit, the professional and whether a review can still be left.
 */
export type PatientReviewContext =
  | { kind: "invalid" | "used" | "expired" }
  | {
      kind: "visit";
      link: AppointmentLinkRow;
      appointment: {
        id: string;
        professional_id: string;
        appointment_datetime: string;
        patient_name: string;
        patient_email: string | null;
      };
      professional: { name: string; slug: string | null };
      eligibility: "ok" | "no_show" | "not_visited" | "already_reviewed";
    };

export async function loadPatientReviewContext(
  service: SupabaseClient,
  token: unknown,
  now: Date = new Date(),
): Promise<PatientReviewContext> {
  if (!isAppointmentLinkTokenShape(token)) return { kind: "invalid" };
  const link = await findAppointmentLink(service, token, "review");
  const state = appointmentLinkState(link, now);
  if (!link || state === "invalid") return { kind: "invalid" };
  if (state !== "usable") return { kind: state };

  const { data: appt } = await service
    .from("appointments")
    .select("id, professional_id, appointment_datetime, status, attendance, patient_name, patient_email")
    .eq("id", link.appointment_id)
    .maybeSingle();
  if (!appt) return { kind: "invalid" };
  const a = appt as {
    id: string;
    professional_id: string;
    appointment_datetime: string;
    status: string | null;
    attendance: string | null;
    patient_name: string;
    patient_email: string | null;
  };

  const [{ data: pro }, { data: existing }] = await Promise.all([
    service.from("professionals").select("name, slug").eq("id", a.professional_id).maybeSingle(),
    service.from("professional_reviews").select("id").eq("appointment_id", a.id).maybeSingle(),
  ]);
  const p = (pro ?? {}) as { name?: string | null; slug?: string | null };
  const eligibility = existing ? "already_reviewed" : reviewEligibility(a);

  return {
    kind: "visit",
    link,
    appointment: {
      id: a.id,
      professional_id: a.professional_id,
      appointment_datetime: a.appointment_datetime,
      patient_name: a.patient_name,
      patient_email: a.patient_email,
    },
    professional: { name: p.name?.trim() || "your professional", slug: p.slug ?? null },
    eligibility,
  };
}
