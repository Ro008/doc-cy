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
 * The patient cancels a confirmed visit from the emailed link (user, 2026-10-04):
 * until X hours before the visit (default 12); then the page shows the clinic phone.
 * Cancelling sets CANCELLED + cancelled_by patient (+ optional reason), uses the link,
 * and frees the time. The page only cancels from its button (email scanners open links).
 */
test.describe("Integration: patient cancels from the email link", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let clinicId = "";
  let linkId = "";
  const nonce = `pcn${Date.now()}`.slice(-12);

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Patient Cancel ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicId = seeded.clinicId;
    linkId = seeded.locationId;
  });

  test.afterAll(async () => {
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, [clinicId]);
  });

  async function confirmedVisit(hoursAhead: number, tag: string) {
    const visitIso = new Date(Math.ceil((Date.now() + hoursAhead * 3_600_000) / 60_000) * 60_000).toISOString();
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro!.doctorId,
        clinic_id: clinicId,
        booking_source: "online",
        patient_name: `Cancel Patient ${tag} ${nonce}`,
        patient_email: `cancel-${tag}-${nonce}@integration.test`,
        patient_phone: "+35799111000",
        patient_gender: "female",
        patient_birthdate: "1991-01-01",
        is_new_patient: true,
        reason: "Integration: patient cancel",
        appointment_datetime: visitIso,
        duration_minutes: 30,
        status: "CONFIRMED",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed visit: ${error?.message}`);
    const id = String(data.id);
    const token = await issueAppointmentLink(admin, { appointmentId: id, purpose: "cancel", expiresAt: new Date(visitIso) });
    return { id, token };
  }

  test("the page asks before cancelling; the button cancels with an optional reason", async ({ page }) => {
    const { id, token } = await confirmedVisit(5 * 24, "page");
    await page.goto(`/booking/cancel?token=${encodeURIComponent(token)}`);
    const button = page.getByRole("button", { name: /^Cancel appointment$/i });
    await expect(button).toBeVisible({ timeout: 20_000 });
    // Opening the link changed nothing.
    const { data: before } = await admin.from("appointments").select("status").eq("id", id).single();
    expect(before!.status).toBe("CONFIRMED");

    await page.getByLabel(/message for/i).fill("I feel better now");
    await button.click();
    await expect(page.getByRole("heading", { name: /appointment cancelled/i })).toBeVisible({ timeout: 20_000 });

    const { data: after } = await admin
      .from("appointments")
      .select("status, cancelled_by, cancel_reason")
      .eq("id", id)
      .single();
    expect(after).toEqual({ status: "CANCELLED", cancelled_by: "patient", cancel_reason: "I feel better now" });
  });

  test("the link works once", async ({ request }) => {
    const { token } = await confirmedVisit(5 * 24 + 1, "once");
    expect((await request.post("/api/booking/cancel", { data: { token } })).status()).toBe(200);
    const again = await request.post("/api/booking/cancel", { data: { token } });
    expect(again.status()).toBe(410);
    expect((await again.json()).state).toBe("used");
  });

  test("after the deadline it refuses and shows the clinic phone", async ({ page, request }) => {
    const { id, token } = await confirmedVisit(3, "late");
    const res = await request.post("/api/booking/cancel", { data: { token } });
    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("window_closed");
    expect(json.clinicPhone).toBe("22123456");

    await page.goto(`/booking/cancel?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: /online cancellation has closed/i })).toBeVisible({ timeout: 20_000 });
    // Shown with the country code, as the clinic block always does.
    await expect(page.getByText("+357 22 123456")).toBeVisible();

    const { data } = await admin.from("appointments").select("status").eq("id", id).single();
    expect(data!.status).toBe("CONFIRMED");
  });

  test("a visit the professional already cancelled can't be cancelled again", async ({ request }) => {
    const { id, token } = await confirmedVisit(5 * 24 + 2, "gone");
    await admin
      .from("appointments")
      .update({ status: "CANCELLED", cancelled_by: "professional", cancel_reason: "Away" })
      .eq("id", id);
    const res = await request.post("/api/booking/cancel", { data: { token } });
    expect(res.status()).toBe(409);
  });
});
