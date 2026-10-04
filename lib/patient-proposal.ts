import type { SupabaseClient } from "@supabase/supabase-js";

import { coerceProposedSlotsArray } from "@/lib/appointment-overlap";
import { appointmentLinkState, findAppointmentLink, type AppointmentLinkRow } from "@/lib/appointment-links-db";
import { isAppointmentLinkTokenShape } from "@/lib/appointment-link-token";

/**
 * What the patient's /booking/choose page and its routes need from the proposal link
 * (user, 2026-10-04): the request, the 1-3 proposed times, the professional and clinic.
 */

export type ProposalAppointment = {
  id: string;
  professional_id: string;
  patient_name: string;
  patient_email: string | null;
  status: string;
  duration_minutes: number | null;
  clinic_id: string | null;
  location_id: string | null;
  reason: string | null;
};

export type PatientProposalContext =
  | { kind: "invalid" | "used" | "expired"; professionalSlug?: string | null }
  | {
      kind: "proposal";
      link: AppointmentLinkRow;
      appointment: ProposalAppointment;
      slots: string[];
      professional: { id: string; name: string; slug: string | null; email: string | null; registration_email: string | null };
      clinic: { name: string; address: string | null };
    };

export async function loadPatientProposalContext(
  service: SupabaseClient,
  token: unknown,
  now: Date = new Date(),
): Promise<PatientProposalContext> {
  if (!isAppointmentLinkTokenShape(token)) return { kind: "invalid" };
  const link = await findAppointmentLink(service, token, "proposal");
  if (!link) return { kind: "invalid" };

  const { data: appt } = await service
    .from("appointments")
    .select("id, professional_id, patient_name, patient_email, status, duration_minutes, clinic_id, location_id, reason, proposed_slots")
    .eq("id", link.appointment_id)
    .maybeSingle();
  if (!appt) return { kind: "invalid" };
  const a = appt as ProposalAppointment & { proposed_slots: unknown };

  const [{ data: pro }, { data: clinic }] = await Promise.all([
    service.from("professionals").select("id, name, slug, email, registration_email").eq("id", a.professional_id).maybeSingle(),
    a.clinic_id ? service.from("clinics").select("name, address").eq("id", a.clinic_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const p = (pro ?? {}) as { id?: string; name?: string; slug?: string | null; email?: string | null; registration_email?: string | null };

  const state = appointmentLinkState(link, now);
  if (state === "used") return { kind: "used", professionalSlug: p.slug ?? null };
  if (state === "expired" || String(a.status).toUpperCase() !== "NEEDS_RESCHEDULE") {
    return { kind: state === "expired" ? "expired" : "used", professionalSlug: p.slug ?? null };
  }

  const slots = coerceProposedSlotsArray(a.proposed_slots)
    .filter((s): s is string => typeof s === "string" && Number.isFinite(new Date(s).getTime()))
    .map((s) => new Date(s).toISOString());
  const c = clinic as { name?: string | null; address?: string | null } | null;

  return {
    kind: "proposal",
    link,
    appointment: a,
    slots,
    professional: {
      id: String(p.id ?? a.professional_id),
      name: String(p.name ?? "your professional"),
      slug: p.slug ?? null,
      email: p.email ?? null,
      registration_email: p.registration_email ?? null,
    },
    clinic: { name: String(c?.name ?? "the clinic"), address: c?.address ?? null },
  };
}
