import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  createTestDoctor,
  deleteTestClinics,
  deleteTestDoctor,
  loginDoctorUi,
  openPrimaryClinicForBookings,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * Accepting a request (user, 2026-10-04): status CONFIRMED (UI may say "Accepted"); the
 * patient's confirmation email carries a cancel link, stored hashed in
 * appointment_links and valid until the visit starts; only a REQUESTED row can be
 * accepted, once.
 */
test.describe("Integration: accept a request", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let clinicId = "";
  let page: Page;
  let appointmentId = "";
  let visitIso = "";
  const nonce = `acc${Date.now()}`.slice(-12);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Accept ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicId = seeded.clinicId;
    // Next weekday 10:00 Cyprus, at least 3 days ahead.
    const day = new Date(Date.now() + 3 * 86_400_000);
    while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() + 1);
    day.setUTCHours(7, 0, 0, 0);
    visitIso = day.toISOString();
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro.doctorId,
        clinic_id: clinicId,
        booking_source: "online",
        patient_name: `Accept Patient ${nonce}`,
        patient_email: `accept-${nonce}@integration.test`,
        patient_phone: "+35799777999",
        patient_gender: "male",
        patient_birthdate: "1988-08-08",
        is_new_patient: false,
        reason: "Integration: accept",
        appointment_datetime: visitIso,
        duration_minutes: 30,
        status: "REQUESTED",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed request: ${error?.message}`);
    appointmentId = String(data.id);
    page = await browser.newPage();
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, [clinicId]);
  });

  const accept = () =>
    page.request.post(`/api/appointments/${appointmentId}/confirm`, { data: { durationMinutes: 30 } });

  test("confirms the visit and issues the patient's cancel link", async () => {
    const res = await accept();
    expect(res.status(), await res.text()).toBe(200);

    const { data: appt } = await admin.from("appointments").select("status").eq("id", appointmentId).single();
    expect(appt!.status).toBe("CONFIRMED");

    const { data: links } = await admin
      .from("appointment_links")
      .select("purpose, expires_at, used_at, token_hash")
      .eq("appointment_id", appointmentId);
    expect(links).toHaveLength(1);
    expect(links![0].purpose).toBe("cancel");
    expect(links![0].used_at).toBeNull();
    expect(new Date(links![0].expires_at).toISOString()).toBe(visitIso);
    expect(links![0].token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("can't be accepted twice", async () => {
    const res = await accept();
    expect(res.status()).toBe(400);
  });
});
