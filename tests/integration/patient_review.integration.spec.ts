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
 * Verified reviews (user, 2026-10-04): the emailed link opens a form (opening changes
 * nothing); the typed email must match the visit's; one review per visit; no review for a
 * no-show; the link works once. Shown as "Maria K.", the email never.
 */
const DAY = 24 * 60 * 60 * 1000;

test.describe("Integration: patient review", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  const clinicIds: string[] = [];
  let linkId = "";
  const nonce = `rev${Date.now()}`.slice(-12);

  test.beforeAll(async () => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Review ${nonce}`, specialty: "Cardiology" });
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicIds.push(seeded.clinicId);
    linkId = seeded.locationId;
  });

  test.afterAll(async () => {
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, clinicIds);
  });

  async function pastVisit(tag: string, extra: Record<string, unknown> = {}) {
    const email = `review-${tag}-${nonce}@integration.test`;
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro!.doctorId,
        clinic_id: clinicIds[0],
        booking_source: "online",
        patient_name: `Maria ${tag} Kyriakou`,
        patient_email: email,
        patient_phone: "+35799555666",
        patient_gender: "female",
        patient_birthdate: "1990-02-02",
        is_new_patient: true,
        reason: "Integration: review",
        appointment_datetime: new Date(Date.now() - 2 * DAY).toISOString(),
        duration_minutes: 30,
        status: "CONFIRMED",
        attendance: "attended",
        review_requested_at: new Date().toISOString(),
        ...extra,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed: ${error?.message}`);
    const id = String(data.id);
    const token = await issueAppointmentLink(admin, {
      appointmentId: id,
      purpose: "review",
      expiresAt: new Date(Date.now() + 30 * DAY),
    });
    return { id, token, email };
  }

  const reviews = async (appointmentId: string) =>
    (await admin.from("professional_reviews").select("*").eq("appointment_id", appointmentId)).data ?? [];

  test("the form says how the name appears and publishes a verified review", async ({ page }) => {
    const { id, token, email } = await pastVisit("ui");
    await page.goto(`/booking/review?token=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: /How was your visit/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/appear as Maria K\./)).toBeVisible();
    expect(await reviews(id)).toHaveLength(0); // opening changes nothing

    await expect(async () => {
      // Click the star (the radio itself is visually hidden).
      await page.getByRole("radio", { name: "4 stars" }).locator("xpath=..").click();
      await expect(page.getByRole("radio", { name: "4 stars" })).toBeChecked({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await page.getByLabel("Your review").fill("Listened carefully and explained everything.");
    await page.getByLabel(/Your email/).fill(email.toUpperCase());
    await page.getByRole("button", { name: "Publish review" }).click();
    await expect(page.getByTestId("review-thanks")).toBeVisible({ timeout: 15_000 });

    const rows = await reviews(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      professional_id: pro!.doctorId,
      rating: 4,
      comment: "Listened carefully and explained everything.",
      reviewer_name: "Maria ui Kyriakou",
      reviewer_email: email,
      status: "published",
    });
  });

  test("refuses an email that isn't the visit's, without using the link", async ({ request }) => {
    const { id, token, email } = await pastVisit("mismatch");
    const wrong = await request.post("/api/booking/review", {
      data: { token, rating: 5, comment: "Great.", email: "someone-else@integration.test" },
    });
    expect(wrong.status()).toBe(400);
    expect((await wrong.json()).code).toBe("email_mismatch");
    // The link still works with the right email.
    const ok = await request.post("/api/booking/review", { data: { token, rating: 5, comment: "Great.", email } });
    expect(ok.status(), await ok.text()).toBe(200);
    expect(await reviews(id)).toHaveLength(1);
  });

  test("the link works once", async ({ request }) => {
    const { token, email } = await pastVisit("once");
    expect((await request.post("/api/booking/review", { data: { token, rating: 3, comment: "Fine.", email } })).status()).toBe(200);
    const again = await request.post("/api/booking/review", { data: { token, rating: 1, comment: "Again.", email } });
    expect(again.status()).toBe(410);
  });

  test("no review for a no-show", async ({ request, page }) => {
    const { id, token, email } = await pastVisit("noshow", { attendance: "no_show" });
    const res = await request.post("/api/booking/review", { data: { token, rating: 5, comment: "Hmm.", email } });
    expect(res.status()).toBe(409);
    expect(await reviews(id)).toHaveLength(0);
    await page.goto(`/booking/review?token=${encodeURIComponent(token)}`);
    await expect(page.getByTestId("review-unavailable")).toBeVisible({ timeout: 20_000 });
  });

  test("refuses a missing rating or an empty review", async ({ request }) => {
    const { token, email } = await pastVisit("bad");
    expect((await request.post("/api/booking/review", { data: { token, comment: "No stars.", email } })).status()).toBe(400);
    expect((await request.post("/api/booking/review", { data: { token, rating: 4, comment: "  ", email } })).status()).toBe(400);
  });

  test("a wrong or expired link doesn't work", async ({ request, page }) => {
    const bad = await request.post("/api/booking/review", {
      data: { token: "x".repeat(43), rating: 5, comment: "Hi.", email: "a@integration.test" },
    });
    expect(bad.status()).toBe(410);

    const { id, email } = await pastVisit("expired");
    const expiredToken = await issueAppointmentLink(admin, {
      appointmentId: id,
      purpose: "review",
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await request.post("/api/booking/review", { data: { token: expiredToken, rating: 5, comment: "Hi.", email } });
    expect(res.status()).toBe(410);
    await page.goto(`/booking/review?token=${encodeURIComponent(expiredToken)}`);
    await expect(page.getByTestId("review-expired")).toBeVisible({ timeout: 20_000 });
  });
});
