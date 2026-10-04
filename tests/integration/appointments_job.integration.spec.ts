import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { issueAppointmentLink } from "@/lib/appointment-links-db";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  createTestDoctor,
  deleteTestClinics,
  deleteTestDoctor,
  openPrimaryClinicForBookings,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * The appointments job (user, 2026-10-04), run scoped to this spec's professional (Testing
 * has no schedule). One run does every task; a second run does nothing (idempotent).
 */
const H = 60 * 60 * 1000;
const at = (offsetHours: number) => new Date(Date.now() + offsetHours * H).toISOString();
const secret = process.env.CRON_SECRET?.trim() ?? "";

test.describe("Integration: appointments job", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!secret, "CRON_SECRET is not set for this environment");

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  const clinicIds: string[] = [];
  let linkId = "";
  const nonce = `job${Date.now()}`.slice(-12);
  const ids: Record<string, string> = {};
  const draftIds: Record<string, string> = {};

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Job ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicIds.push(seeded.clinicId);
    linkId = seeded.locationId;

    const row = (tag: string, startOffsetHours: number, extra: Record<string, unknown>) => ({
      professional_id: pro!.doctorId,
      clinic_id: clinicIds[0],
      booking_source: "online",
      patient_name: `Job Patient ${tag}`,
      patient_email: `job-${tag}-${nonce}@integration.test`,
      patient_phone: "+35799111222",
      patient_gender: "female",
      patient_birthdate: "1985-05-05",
      is_new_patient: true,
      reason: "Integration: job",
      appointment_datetime: at(startOffsetHours),
      duration_minutes: 30,
      ...extra,
    });
    const seeds: Record<string, Record<string, unknown>> = {
      unanswered: row("unanswered", -1, { status: "REQUESTED" }),
      pending: row("pending", 30, { status: "REQUESTED" }),
      lapsed: row("lapsed", 10, {
        status: "NEEDS_RESCHEDULE",
        proposed_slots: [at(30), at(31)],
        proposal_expires_at: at(-0.5),
      }),
      remind: row("remind", 11, {
        status: "NEEDS_RESCHEDULE",
        proposed_slots: [at(40)],
        proposal_expires_at: at(2),
      }),
      visitSoon: row("visitsoon", 20, { status: "CONFIRMED", created_at: at(-72) }),
      bookedLate: row("bookedlate", 21, { status: "CONFIRMED", created_at: at(-1) }),
      ended: row("ended", -3, { status: "CONFIRMED" }),
      noShow: row("noshow", -3.5, { status: "CONFIRMED", attendance: "no_show" }),
      review: row("review", -25, { status: "CONFIRMED", attendance: "attended" }),
      reviewNoShow: row("reviewnoshow", -26, { status: "CONFIRMED", attendance: "no_show" }),
    };
    for (const [key, seed] of Object.entries(seeds)) {
      const { data, error } = await admin.from("appointments").insert(seed).select("id").single();
      if (error || !data) throw new Error(`seed ${key}: ${error?.message}`);
      ids[key] = String(data.id);
    }
    await issueAppointmentLink(admin, { appointmentId: ids.lapsed!, purpose: "proposal", expiresAt: new Date(at(-0.5)) });
    await issueAppointmentLink(admin, { appointmentId: ids.remind!, purpose: "proposal", expiresAt: new Date(at(2)) });

    const draft = (tag: string, expiresOffsetHours: number) => ({
      professional_id: pro!.doctorId,
      clinic_id: clinicIds[0],
      appointment_datetime: at(48),
      duration_minutes: 30,
      patient_name: `Draft ${tag}`,
      patient_email: `job-draft-${tag}-${nonce}@integration.test`,
      patient_phone: "+35799111333",
      patient_gender: "male",
      patient_birthdate: "1980-01-01",
      is_new_patient: false,
      reason: "Integration: draft",
      token_hash: `job-${tag}-${nonce}-${Math.random().toString(36).slice(2)}`,
      expires_at: at(expiresOffsetHours),
    });
    for (const [key, offset] of [["old", -48], ["fresh", 0.5]] as const) {
      const { data, error } = await admin.from("appointment_drafts").insert(draft(key, offset)).select("id").single();
      if (error || !data) throw new Error(`draft ${key}: ${error?.message}`);
      draftIds[key] = String(data.id);
    }
  });

  test.afterAll(async () => {
    if (pro) {
      await admin.from("appointment_drafts").delete().eq("professional_id", pro.doctorId);
      await deleteTestDoctor(pro);
    }
    await deleteTestClinics(admin, clinicIds);
  });

  const run = (request: import("@playwright/test").APIRequestContext) =>
    request.post("/api/cron/appointments", {
      headers: { Authorization: `Bearer ${secret}` },
      data: { professionalId: pro!.doctorId },
    });

  const rowOf = async (key: string) =>
    (
      await admin
        .from("appointments")
        .select("status, attendance, proposal_expires_at, proposal_reminder_sent_at, visit_reminder_sent_at, review_requested_at")
        .eq("id", ids[key]!)
        .single()
    ).data!;
  const linksOf = async (key: string, purpose: string) =>
    (await admin.from("appointment_links").select("used_at, expires_at").eq("appointment_id", ids[key]!).eq("purpose", purpose)).data ?? [];

  test("refuses a call without the secret", async ({ request }) => {
    expect((await request.post("/api/cron/appointments", { data: {} })).status()).toBe(401);
    expect(
      (await request.post("/api/cron/appointments", { headers: { Authorization: "Bearer nope" }, data: {} })).status(),
    ).toBe(401);
  });

  test("one run does every task", async ({ request }) => {
    test.setTimeout(120_000);
    const res = await run(request);
    const body = await res.json();
    expect(res.status(), JSON.stringify(body)).toBe(200);
    expect(body).toMatchObject({
      expiredRequests: 1,
      expiredProposals: 1,
      proposalReminders: 1,
      visitReminders: 1,
      markedAttended: 1,
      reviewRequests: 1,
      purgedDrafts: 1,
      errors: [],
    });

    // Unanswered request past its time → EXPIRED; a future one stays.
    expect((await rowOf("unanswered")).status).toBe("EXPIRED");
    expect((await rowOf("pending")).status).toBe("REQUESTED");

    // Lapsed proposal → EXPIRED, deadline kept (the dashboard lists it), link revoked.
    const lapsed = await rowOf("lapsed");
    expect(lapsed.status).toBe("EXPIRED");
    expect(lapsed.proposal_expires_at).not.toBeNull();
    expect((await linksOf("lapsed", "proposal")).every((l) => l.used_at)).toBe(true);

    // Reminder 3 h before: marked, a second usable link added, the first still works.
    const remind = await rowOf("remind");
    expect(remind.status).toBe("NEEDS_RESCHEDULE");
    expect(remind.proposal_reminder_sent_at).not.toBeNull();
    const remindLinks = await linksOf("remind", "proposal");
    expect(remindLinks).toHaveLength(2);
    expect(remindLinks.every((l) => !l.used_at)).toBe(true);

    // Visit reminder ~24 h before, not for a visit booked an hour ago.
    expect((await rowOf("visitSoon")).visit_reminder_sent_at).not.toBeNull();
    expect((await rowOf("bookedLate")).visit_reminder_sent_at).toBeNull();

    // Attended 2 h after the end; a no-show stays.
    expect((await rowOf("ended")).attendance).toBe("attended");
    expect((await rowOf("noShow")).attendance).toBe("no_show");

    // Review email 24 h after an attended visit, with a review link; never for a no-show.
    expect((await rowOf("review")).review_requested_at).not.toBeNull();
    expect(await linksOf("review", "review")).toHaveLength(1);
    expect((await rowOf("reviewNoShow")).review_requested_at).toBeNull();
    expect(await linksOf("reviewNoShow", "review")).toHaveLength(0);

    // Old unconfirmed draft deleted, a fresh one kept.
    const { data: drafts } = await admin.from("appointment_drafts").select("id").in("id", Object.values(draftIds));
    expect((drafts ?? []).map((d) => d.id)).toEqual([draftIds.fresh]);
  });

  test("a second run does nothing", async ({ request }) => {
    const res = await run(request);
    expect(await res.json()).toMatchObject({
      expiredRequests: 0,
      expiredProposals: 0,
      proposalReminders: 0,
      visitReminders: 0,
      markedAttended: 0,
      reviewRequests: 0,
      purgedDrafts: 0,
    });
  });
});
