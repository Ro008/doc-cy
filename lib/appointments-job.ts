import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildPatientRequestExpiredEmail, buildPatientVisitReminderEmail } from "@/lib/appointment-job-emails";
import { APPOINTMENT_ATTENDANCE_ATTENDED } from "@/lib/appointment-attendance";
import { appointmentLinkUrl } from "@/lib/appointment-link-token";
import { issueAppointmentLink, issuePatientCancelLink, revokeAppointmentLinks } from "@/lib/appointment-links-db";
import { appointmentToCyprusDate } from "@/lib/appointments";
import type { BuiltEmail } from "@/lib/booking-request-emails";
import { clinicMapsUrl } from "@/lib/clinic-info";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { parsePatientCancelNoticeHours, patientCanCancel } from "@/lib/patient-cancel-window";
import { REVIEW_LINK_DAYS } from "@/lib/professional-review";
import { buildPatientRescheduleReminderEmailContent, RESCHEDULE_REMINDER_LEAD_HOURS } from "@/lib/reschedule-emails";
import { buildPatientReviewRequestEmail } from "@/lib/review-request-email";

/**
 * The scheduled job behind POST /api/cron/appointments (user, 2026-10-04), every 15 minutes
 * (Supabase pg_cron + pg_net). Each task is idempotent: rows are claimed with a guarded
 * UPDATE before any email, so a run that overlaps another sends nothing twice.
 * - unanswered request past its time → EXPIRED + one short email to the patient
 * - proposal past its deadline → EXPIRED, no emails (the times free up)
 * - proposal reminder 3 h before the deadline
 * - visit reminder ~24 h before (with the cancel link while it's open)
 * - attended 2 h after the visit ends (she can switch to no-show)
 * - review email 24 h after the visit ends, unless a no-show
 * - unconfirmed booking drafts deleted a day after their link expired
 * Patient emails only go out for times in the last EMAIL_BACKLOG_DAYS, so a backlog
 * (first run, an outage) never floods anyone.
 */
export const VISIT_REMINDER_HOURS = 24;
export const ATTENDED_AFTER_END_HOURS = 2;
export const REVIEW_AFTER_END_HOURS = 24;
export const EMAIL_BACKLOG_DAYS = 7;
const DRAFT_PURGE_AFTER_HOURS = 24;
const BATCH = 200;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function endMs(startIso: string, durationMinutes: number | null | undefined): number {
  const minutes = typeof durationMinutes === "number" && durationMinutes > 0 ? durationMinutes : 30;
  return new Date(startIso).getTime() + minutes * 60 * 1000;
}

export function isVisitReminderDue(input: { startIso: string; createdIso: string | null; now: Date }): boolean {
  const start = new Date(input.startIso).getTime();
  const now = input.now.getTime();
  if (!(start > now) || start - now > VISIT_REMINDER_HOURS * HOUR_MS) return false;
  // Booked less than a day ahead: they just booked, no reminder.
  const created = input.createdIso ? new Date(input.createdIso).getTime() : NaN;
  return Number.isFinite(created) && start - created >= VISIT_REMINDER_HOURS * HOUR_MS;
}

export function isAttendedDue(input: { startIso: string; durationMinutes: number | null | undefined; now: Date }): boolean {
  return endMs(input.startIso, input.durationMinutes) + ATTENDED_AFTER_END_HOURS * HOUR_MS <= input.now.getTime();
}

export function isReviewRequestDue(input: {
  startIso: string;
  durationMinutes: number | null | undefined;
  now: Date;
}): boolean {
  const end = endMs(input.startIso, input.durationMinutes);
  const now = input.now.getTime();
  return end + REVIEW_AFTER_END_HOURS * HOUR_MS <= now && end >= now - EMAIL_BACKLOG_DAYS * DAY_MS;
}

export type AppointmentsJobDeps = {
  service: SupabaseClient;
  now: Date;
  siteUrl: string;
  send: (to: string | null | undefined, email: BuiltEmail) => Promise<void>;
  /** Limit the run to one professional (integration specs on Testing). */
  professionalId?: string | null;
};

export type AppointmentsJobResult = {
  expiredRequests: number;
  expiredProposals: number;
  proposalReminders: number;
  visitReminders: number;
  markedAttended: number;
  reviewRequests: number;
  purgedDrafts: number;
  errors: string[];
};

type Row = Record<string, unknown> & { id: string; professional_id: string };

type ProfessionalInfo = { name: string; slug: string | null };

async function professionalsById(service: SupabaseClient, ids: string[]): Promise<Map<string, ProfessionalInfo>> {
  const unique = [...new Set(ids)];
  const map = new Map<string, ProfessionalInfo>();
  if (unique.length === 0) return map;
  const { data, error } = await service.from("professionals").select("id, name, slug").in("id", unique);
  if (error) throw error;
  for (const p of (data ?? []) as { id: string; name: string | null; slug: string | null }[]) {
    map.set(p.id, { name: p.name?.trim() || "your professional", slug: p.slug });
  }
  return map;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function recentEnough(iso: string, now: Date): boolean {
  return new Date(iso).getTime() >= now.getTime() - EMAIL_BACKLOG_DAYS * DAY_MS;
}

export async function runAppointmentsJob(deps: AppointmentsJobDeps): Promise<AppointmentsJobResult> {
  const { service, now, siteUrl, send } = deps;
  const nowIso = now.toISOString();
  const result: AppointmentsJobResult = {
    expiredRequests: 0,
    expiredProposals: 0,
    proposalReminders: 0,
    visitReminders: 0,
    markedAttended: 0,
    reviewRequests: 0,
    purgedDrafts: 0,
    errors: [],
  };
  // Typed loosely: the filter builder's generics are too deep to pass through a helper.
  const scoped = (q: any): any => (deps.professionalId ? q.eq("professional_id", deps.professionalId) : q);

  /** Ids of up to BATCH rows matching the filters (then claimed with a guarded UPDATE). */
  async function candidateIds(build: (q: any) => any): Promise<string[]> {
    const { data, error } = await scoped(build(service.from("appointments").select("id"))).limit(BATCH);
    if (error) throw error;
    return ((data ?? []) as { id: string }[]).map((r) => r.id);
  }

  async function task(name: keyof Omit<AppointmentsJobResult, "errors">, run: () => Promise<number>) {
    try {
      result[name] = await run();
    } catch (err) {
      console.error(`[DocCy] appointments job: ${name}`, err);
      result.errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 1. Unanswered requests whose time has come: EXPIRED, the patient is told once.
  await task("expiredRequests", async () => {
    const ids = await candidateIds((q) => q.eq("status", "REQUESTED").lte("appointment_datetime", nowIso));
    if (ids.length === 0) return 0;
    const { data, error } = await service
      .from("appointments")
      .update({ status: "EXPIRED" })
      .in("id", ids)
      .eq("status", "REQUESTED")
      .select("id, professional_id, patient_name, patient_email, appointment_datetime");
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    const pros = await professionalsById(service, rows.map((r) => r.professional_id));
    for (const r of rows) {
      if (!r.patient_email || !recentEnough(str(r.appointment_datetime), now)) continue;
      const pro = pros.get(r.professional_id);
      await send(
        str(r.patient_email),
        buildPatientRequestExpiredEmail({
          patientName: str(r.patient_name),
          professionalName: pro?.name ?? "your professional",
          appointmentIso: str(r.appointment_datetime),
          bookUrl: pro?.slug ? new URL(publicProfessionalProfilePath(pro.slug), siteUrl).toString() : null,
        }),
      );
    }
    return rows.length;
  });

  // 2. Proposals past their deadline: EXPIRED quietly; the held times free up.
  await task("expiredProposals", async () => {
    const ids = await candidateIds((q) => q.eq("status", "NEEDS_RESCHEDULE").lte("proposal_expires_at", nowIso));
    if (ids.length === 0) return 0;
    const { data, error } = await service
      .from("appointments")
      .update({ status: "EXPIRED" })
      .in("id", ids)
      .eq("status", "NEEDS_RESCHEDULE")
      .select("id");
    if (error) throw error;
    for (const r of (data ?? []) as { id: string }[]) {
      await revokeAppointmentLinks(service, r.id, "proposal", now);
    }
    return (data ?? []).length;
  });

  // 3. Proposal reminder, once, in the last 3 hours.
  await task("proposalReminders", async () => {
    const ids = await candidateIds((q) =>
      q
        .eq("status", "NEEDS_RESCHEDULE")
        .is("proposal_reminder_sent_at", null)
        .gt("proposal_expires_at", nowIso)
        .lte("proposal_expires_at", new Date(now.getTime() + RESCHEDULE_REMINDER_LEAD_HOURS * HOUR_MS).toISOString()),
    );
    if (ids.length === 0) return 0;
    const { data, error } = await service
      .from("appointments")
      .update({ proposal_reminder_sent_at: nowIso })
      .in("id", ids)
      .eq("status", "NEEDS_RESCHEDULE")
      .is("proposal_reminder_sent_at", null)
      .select("id, professional_id, patient_name, patient_email, proposed_slots, proposal_expires_at");
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    const pros = await professionalsById(service, rows.map((r) => r.professional_id));
    let sent = 0;
    for (const r of rows) {
      if (!r.patient_email) continue;
      const expiresAt = str(r.proposal_expires_at);
      const token = await issueAppointmentLink(
        service,
        { appointmentId: r.id, purpose: "proposal", expiresAt: new Date(expiresAt), keepOlder: true },
        now,
      );
      const slots = Array.isArray(r.proposed_slots) ? (r.proposed_slots as string[]) : [];
      const email = buildPatientRescheduleReminderEmailContent({
        patientName: str(r.patient_name),
        chooseUrl: appointmentLinkUrl(siteUrl, "proposal", token),
        proposalExpiresAtIso: expiresAt,
        doctorName: pros.get(r.professional_id)?.name ?? "your professional",
        slotLabelsCyprus: slots.map((s) => format(appointmentToCyprusDate(s), "EEE d MMM, HH:mm", { locale: enGB })),
      });
      await send(str(r.patient_email), email);
      sent += 1;
    }
    return sent;
  });

  // 4. Visit reminder ~24 h before, with the cancel link while online cancelling is open.
  await task("visitReminders", async () => {
    const { data: candidates, error } = await scoped(
      service
        .from("appointments")
        .select("id, professional_id, appointment_datetime, created_at")
        .eq("status", "CONFIRMED")
        .is("visit_reminder_sent_at", null)
        .not("patient_email", "is", null)
        .gt("appointment_datetime", nowIso)
        .lte("appointment_datetime", new Date(now.getTime() + VISIT_REMINDER_HOURS * HOUR_MS).toISOString()),
    ).limit(BATCH);
    if (error) throw error;
    const due = ((candidates ?? []) as Row[])
      .filter((r) => isVisitReminderDue({ startIso: str(r.appointment_datetime), createdIso: str(r.created_at) || null, now }))
      .map((r) => r.id);
    if (due.length === 0) return 0;
    const { data, error: claimErr } = await service
      .from("appointments")
      .update({ visit_reminder_sent_at: nowIso })
      .in("id", due)
      .eq("status", "CONFIRMED")
      .is("visit_reminder_sent_at", null)
      .select("id, professional_id, patient_name, patient_email, appointment_datetime, clinic_id");
    if (claimErr) throw claimErr;
    const rows = (data ?? []) as Row[];
    const pros = await professionalsById(service, rows.map((r) => r.professional_id));
    const clinicIds = [...new Set(rows.map((r) => str(r.clinic_id)).filter(Boolean))];
    const [{ data: clinics }, { data: settings }] = await Promise.all([
      clinicIds.length
        ? service.from("clinics").select("id, name, address, address_maps_link, latitude, longitude").in("id", clinicIds)
        : Promise.resolve({ data: [] as { id: string; name: string; address: string | null }[] }),
      service
        .from("professional_settings")
        .select("professional_id, patient_cancel_notice_hours")
        .in("professional_id", [...new Set(rows.map((r) => r.professional_id))]),
    ]);
    const clinicById = new Map(
      (
        (clinics ?? []) as {
          id: string;
          name: string;
          address: string | null;
          address_maps_link: string | null;
          latitude: number | null;
          longitude: number | null;
        }[]
      ).map((c) => [c.id, c]),
    );
    const noticeBy = new Map(
      ((settings ?? []) as { professional_id: string; patient_cancel_notice_hours: number | null }[]).map((s) => [
        s.professional_id,
        parsePatientCancelNoticeHours(s.patient_cancel_notice_hours),
      ]),
    );
    for (const r of rows) {
      const startIso = str(r.appointment_datetime);
      const noticeHours = noticeBy.get(r.professional_id) ?? parsePatientCancelNoticeHours(null);
      const cancel = patientCanCancel(startIso, noticeHours, now)
        ? await issuePatientCancelLink(
            service,
            { id: r.id, professional_id: r.professional_id, appointment_datetime: startIso },
            siteUrl,
            { keepOlder: true },
          )
        : null;
      const clinic = clinicById.get(str(r.clinic_id));
      await send(
        str(r.patient_email),
        buildPatientVisitReminderEmail({
          patientName: str(r.patient_name),
          professionalName: pros.get(r.professional_id)?.name ?? "your professional",
          appointmentIso: startIso,
          clinic: {
            name: clinic?.name ?? "the clinic",
            address: clinic?.address ?? null,
            mapsUrl: clinic
              ? clinicMapsUrl({
                  mapsLink: clinic.address_maps_link,
                  latitude: clinic.latitude,
                  longitude: clinic.longitude,
                  address: clinic.address,
                })
              : null,
          },
          cancel,
        }),
      );
    }
    return rows.length;
  });

  // 5. Attended 2 h after the visit ends, unless she already chose.
  await task("markedAttended", async () => {
    const { data: candidates, error } = await scoped(
      service
        .from("appointments")
        .select("id, appointment_datetime, duration_minutes")
        .eq("status", "CONFIRMED")
        .is("attendance", null)
        .lte("appointment_datetime", new Date(now.getTime() - ATTENDED_AFTER_END_HOURS * HOUR_MS).toISOString()),
    ).limit(BATCH * 2);
    if (error) throw error;
    const due = ((candidates ?? []) as Row[])
      .filter((r) =>
        isAttendedDue({ startIso: str(r.appointment_datetime), durationMinutes: r.duration_minutes as number | null, now }),
      )
      .map((r) => r.id);
    if (due.length === 0) return 0;
    const { data, error: updErr } = await service
      .from("appointments")
      .update({ attendance: APPOINTMENT_ATTENDANCE_ATTENDED })
      .in("id", due)
      .eq("status", "CONFIRMED")
      .is("attendance", null)
      .select("id");
    if (updErr) throw updErr;
    return (data ?? []).length;
  });

  // 6. Review email 24 h after an attended visit.
  await task("reviewRequests", async () => {
    const { data: candidates, error } = await scoped(
      service
        .from("appointments")
        .select("id, appointment_datetime, duration_minutes")
        .eq("status", "CONFIRMED")
        .eq("attendance", APPOINTMENT_ATTENDANCE_ATTENDED)
        .is("review_requested_at", null)
        .not("patient_email", "is", null)
        .gte("appointment_datetime", new Date(now.getTime() - (EMAIL_BACKLOG_DAYS + 1) * DAY_MS).toISOString())
        .lte("appointment_datetime", new Date(now.getTime() - REVIEW_AFTER_END_HOURS * HOUR_MS).toISOString()),
    ).limit(BATCH);
    if (error) throw error;
    const due = ((candidates ?? []) as Row[])
      .filter((r) =>
        isReviewRequestDue({ startIso: str(r.appointment_datetime), durationMinutes: r.duration_minutes as number | null, now }),
      )
      .map((r) => r.id);
    if (due.length === 0) return 0;
    const { data, error: claimErr } = await service
      .from("appointments")
      .update({ review_requested_at: nowIso })
      .in("id", due)
      .eq("status", "CONFIRMED")
      .eq("attendance", APPOINTMENT_ATTENDANCE_ATTENDED)
      .is("review_requested_at", null)
      .select("id, professional_id, patient_name, patient_email, appointment_datetime");
    if (claimErr) throw claimErr;
    const rows = (data ?? []) as Row[];
    const pros = await professionalsById(service, rows.map((r) => r.professional_id));
    for (const r of rows) {
      const token = await issueAppointmentLink(
        service,
        { appointmentId: r.id, purpose: "review", expiresAt: new Date(now.getTime() + REVIEW_LINK_DAYS * DAY_MS) },
        now,
      );
      await send(
        str(r.patient_email),
        buildPatientReviewRequestEmail({
          patientName: str(r.patient_name),
          professionalName: pros.get(r.professional_id)?.name ?? "your professional",
          appointmentIso: str(r.appointment_datetime),
          reviewUrl: appointmentLinkUrl(siteUrl, "review", token),
        }),
      );
    }
    return rows.length;
  });

  // 7. Booking drafts nobody confirmed (they hold no time), a day after the link expired.
  await task("purgedDrafts", async () => {
    const { data, error } = await scoped(
      service
        .from("appointment_drafts")
        .delete()
        .is("confirmed_at", null)
        .lt("expires_at", new Date(now.getTime() - DRAFT_PURGE_AFTER_HOURS * HOUR_MS).toISOString()),
    ).select("id");
    if (error) throw error;
    return (data ?? []).length;
  });

  return result;
}
