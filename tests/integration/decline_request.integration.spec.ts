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
 * Declining a request (user, 2026-10-03): a reason of at least 10 characters, shown to
 * the patient; the row is kept as DECLINED with `decline_reason` (never deleted); only
 * a request still REQUESTED can be declined; a declined request leaves the agenda.
 */
test.describe("Integration: decline a request", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let clinicId = "";
  let linkId = "";
  let page: Page;
  let appointmentId = "";
  const nonce = `dcl${Date.now()}`.slice(-12);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Decline ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicId = seeded.clinicId;
    linkId = seeded.locationId;
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro.doctorId,
        clinic_id: clinicId,
        booking_source: "online",
        patient_name: `Decline Patient ${nonce}`,
        patient_email: `decline-${nonce}@integration.test`,
        patient_phone: "+35799777888",
        patient_gender: "female",
        patient_birthdate: "1992-02-02",
        is_new_patient: true,
        reason: "Integration: decline",
        appointment_datetime: new Date(Date.now() + 5 * 86_400_000).toISOString(),
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

  const decline = (reason: string) =>
    page.request.post(`/api/appointments/${appointmentId}/reject`, { data: { reason } });

  test("needs a reason of at least 10 characters", async () => {
    const res = await decline("Too short");
    expect(res.status()).toBe(400);
  });

  test("keeps the request as DECLINED with the reason", async () => {
    const res = await decline("I am away that week, sorry.");
    expect(res.status(), await res.text()).toBe(200);
    const { data } = await admin
      .from("appointments")
      .select("status, decline_reason")
      .eq("id", appointmentId)
      .single();
    expect(data).toEqual({ status: "DECLINED", decline_reason: "I am away that week, sorry." });
  });

  test("a declined request can't be declined again", async () => {
    const res = await decline("Second attempt to decline it.");
    expect(res.status()).toBe(400);
  });

  test("a declined request is not in the agenda", async () => {
    await page.goto("/agenda?view=month", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("agenda-page")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`Decline Patient ${nonce}`)).toHaveCount(0);
  });
});
