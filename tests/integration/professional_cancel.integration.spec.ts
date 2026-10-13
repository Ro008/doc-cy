import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { issueAppointmentLink } from "@/lib/appointment-links-db";
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
 * The professional cancels a confirmed visit (user, 2026-10-04): any time until it
 * starts; reason required (>= 10); the row is kept as CANCELLED, cancelled_by
 * professional, cancel_reason; the patient's own cancel link stops working. Without a
 * patient email she is told to call (the response says so).
 */
test.describe("Integration: professional cancels a confirmed visit", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let clinicId = "";
  let linkId = "";
  let page: Page;
  const nonce = `prc${Date.now()}`.slice(-12);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Pro Cancel ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicId = seeded.clinicId;
    linkId = seeded.locationId;
    page = await browser.newPage();
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, [clinicId]);
  });

  async function confirmedVisit(minutesAhead: number, tag: string, email: string | null) {
    const visitIso = new Date(Math.ceil((Date.now() + minutesAhead * 60_000) / 60_000) * 60_000).toISOString();
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro!.doctorId,
        clinic_id: clinicId,
        booking_source: email ? "online" : "manual",
        patient_name: `Pro Cancel Patient ${tag} ${nonce}`,
        patient_email: email,
        patient_phone: "+35799222333",
        patient_gender: "male",
        patient_birthdate: "1980-01-01",
        is_new_patient: false,
        reason: "Integration: professional cancel",
        appointment_datetime: visitIso,
        duration_minutes: 30,
        status: "CONFIRMED",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed visit: ${error?.message}`);
    return { id: String(data.id), visitIso };
  }

  const cancel = (id: string, reason: string) =>
    page.request.post(`/api/appointments/${id}/cancel-confirmed`, { data: { reason } });

  test("keeps the visit as cancelled by her, with the reason, and revokes the patient's link", async () => {
    const { id, visitIso } = await confirmedVisit(5 * 24 * 60, "a", `pro-cancel-a-${nonce}@integration.test`);
    await issueAppointmentLink(admin, { appointmentId: id, purpose: "cancel", expiresAt: new Date(visitIso) });

    expect((await cancel(id, "Too short")).status()).toBe(400);

    const res = await cancel(id, "I am ill that day, sorry.");
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).patientHasEmail).toBe(true);

    const { data } = await admin
      .from("appointments")
      .select("status, cancelled_by, cancel_reason")
      .eq("id", id)
      .single();
    expect(data).toEqual({ status: "CANCELLED", cancelled_by: "professional", cancel_reason: "I am ill that day, sorry." });

    const { data: links } = await admin.from("appointment_links").select("used_at").eq("appointment_id", id);
    expect(links!.every((l) => l.used_at !== null)).toBe(true);
  });

  test("the agenda's cancel dialog warns at short notice", async () => {
    const { visitIso } = await confirmedVisit(90, "ui", `pro-cancel-ui-${nonce}@integration.test`);
    const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia" }).format(new Date(visitIso));
    await page.goto(`/agenda?date=${dateKey}&view=day`, { waitUntil: "domcontentloaded" });
    const visit = page.locator("button:visible", { hasText: `Pro Cancel Patient ui ${nonce}` }).first();
    await expect(visit).toBeVisible({ timeout: 20_000 });
    await expect(async () => {
      await visit.click();
      await expect(page.getByRole("button", { name: /^Cancel appointment$/i })).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("button", { name: /^Cancel appointment$/i }).click();
    await expect(page.getByTestId("cancel-short-notice")).toBeVisible({ timeout: 10_000 });
  });

  test("works at short notice (until the visit starts)", async () => {
    const { id } = await confirmedVisit(60, "b", `pro-cancel-b-${nonce}@integration.test`);
    expect((await cancel(id, "Emergency at the hospital.")).status()).toBe(200);
  });

  test("refuses a visit that has started", async () => {
    const { id } = await confirmedVisit(-5, "c", `pro-cancel-c-${nonce}@integration.test`);
    expect((await cancel(id, "Too late to cancel this one.")).status()).toBe(400);
  });

  test("tells her to call when the patient has no email", async () => {
    const { id } = await confirmedVisit(3 * 24 * 60, "d", null);
    const res = await cancel(id, "Clinic closed that day.");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.patientHasEmail).toBe(false);
    expect(json.patientPhone).toBe("+35799222333");
  });
});
