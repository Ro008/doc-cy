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
 * The patient answers a proposal from the emailed link (user, 2026-10-04), no ping-pong:
 * - picks one time → CONFIRMED at that time, the other held times are freed, the
 *   professional is emailed, the patient gets the confirmation with a cancel link;
 * - declines → CANCELLED, cancelled_by patient (optional message); professional emailed;
 * - no answer: the link expires with the proposal.
 * The page only acts from its buttons (email scanners open links).
 */
test.describe("Integration: patient answers a proposal", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let clinicId = "";
  let linkId = "";
  const nonce = `pch${Date.now()}`.slice(-12);
  const hour = 3_600_000;

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Choose ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicId = seeded.clinicId;
    linkId = seeded.locationId;
  });

  test.afterAll(async () => {
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, [clinicId]);
  });

  /** A request with a live (or lapsed) proposal of two times and its link. */
  async function proposal(tag: string, dayOffset: number, opts: { lapsed?: boolean } = {}) {
    const base = Math.ceil((Date.now() + dayOffset * 24 * hour) / hour) * hour;
    const slots = [new Date(base + 2 * hour).toISOString(), new Date(base + 4 * hour).toISOString()];
    const expiresAt = new Date(Date.now() + (opts.lapsed ? -60_000 : 20 * hour));
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro!.doctorId,
        clinic_id: clinicId,
        location_id: linkId,
        booking_source: "online",
        patient_name: `Choose Patient ${tag} ${nonce}`,
        patient_email: `choose-${tag}-${nonce}@integration.test`,
        patient_phone: "+35799666777",
        patient_gender: "female",
        patient_birthdate: "1995-05-05",
        is_new_patient: true,
        reason: "Integration: proposal answer",
        appointment_datetime: new Date(base).toISOString(),
        duration_minutes: 30,
        status: "NEEDS_RESCHEDULE",
        proposed_slots: slots,
        proposal_expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed: ${error?.message}`);
    const id = String(data.id);
    const token = await issueAppointmentLink(admin, { appointmentId: id, purpose: "proposal", expiresAt });
    return { id, token, slots };
  }

  test("the page lists the times; picking one confirms the visit at that time", async ({ page }) => {
    const { id, token, slots } = await proposal("pick", 3);
    await page.goto(`/booking/choose?token=${encodeURIComponent(token)}`);
    const options = page.getByRole("radio");
    await expect(options).toHaveCount(2, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: /decline/i })).toBeVisible();

    await options.nth(1).check();
    await page.getByRole("button", { name: /confirm this time/i }).click();
    await expect(page.getByRole("heading", { name: /visit confirmed/i })).toBeVisible({ timeout: 20_000 });

    const { data } = await admin
      .from("appointments")
      .select("status, appointment_datetime, proposed_slots, proposal_expires_at")
      .eq("id", id)
      .single();
    expect(data!.status).toBe("CONFIRMED");
    expect(new Date(data!.appointment_datetime).toISOString()).toBe(slots[1]);
    expect(data!.proposed_slots).toBeNull();
    expect(data!.proposal_expires_at).toBeNull();

    const { data: links } = await admin
      .from("appointment_links")
      .select("purpose, used_at")
      .eq("appointment_id", id)
      .order("created_at");
    expect(links!.find((l) => l.purpose === "proposal")!.used_at).not.toBeNull();
    expect(links!.find((l) => l.purpose === "cancel")!.used_at).toBeNull();
  });

  test("the link works once", async ({ request }) => {
    const { token, slots } = await proposal("once", 4);
    expect((await request.post("/api/booking/choose", { data: { token, slot: slots[0] } })).status()).toBe(200);
    const again = await request.post("/api/booking/choose", { data: { token, slot: slots[0] } });
    expect(again.status()).toBe(410);
  });

  test("only one of the proposed times can be picked", async ({ request }) => {
    const { token, slots } = await proposal("other", 5);
    const res = await request.post("/api/booking/choose", {
      data: { token, slot: new Date(new Date(slots[0]).getTime() + hour).toISOString() },
    });
    expect(res.status()).toBe(400);
  });

  test("a time someone took meanwhile is refused", async ({ request }) => {
    const { token, slots } = await proposal("taken", 6);
    await admin.from("appointments").insert({
      professional_id: pro!.doctorId,
      clinic_id: clinicId,
      location_id: linkId,
      patient_name: `Blocker ${nonce}`,
      patient_phone: "+35799000999",
      appointment_datetime: slots[0],
      duration_minutes: 30,
      status: "CONFIRMED",
    });
    const res = await request.post("/api/booking/choose", { data: { token, slot: slots[0] } });
    expect(res.status()).toBe(409);
  });

  test("declining cancels the request with the patient's message", async ({ request }) => {
    const { id, token } = await proposal("decline", 7);
    const res = await request.post("/api/booking/decline-proposal", { data: { token, message: "None of these suit me." } });
    expect(res.status(), await res.text()).toBe(200);
    const { data } = await admin
      .from("appointments")
      .select("status, cancelled_by, cancel_reason, proposed_slots")
      .eq("id", id)
      .single();
    expect(data).toEqual({
      status: "CANCELLED",
      cancelled_by: "patient",
      cancel_reason: "None of these suit me.",
      proposed_slots: null,
    });
  });

  test("a lapsed proposal's link has expired", async ({ page, request }) => {
    const { token, slots } = await proposal("lapsed", 8, { lapsed: true });
    const res = await request.post("/api/booking/choose", { data: { token, slot: slots[0] } });
    expect(res.status()).toBe(410);
    expect((await res.json()).state).toBe("expired");
    await page.goto(`/booking/choose?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: /expired/i })).toBeVisible({ timeout: 20_000 });
  });
});
