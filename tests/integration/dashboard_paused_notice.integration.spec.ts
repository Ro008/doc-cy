import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  createTestDoctor,
  deleteTestClinics,
  deleteTestDoctor,
  loginDoctorUi,
  openPrimaryClinicForBookings,
  seedProfessionalClinic,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

/**
 * Dashboard paused banner (user, 2026-10-03): one line per paused clinic, by the clinic's
 * name, each closable with an "x" so it doesn't show again; it shows again when that
 * clinic's pause changes (a trigger clears pause_notice_dismissed_at).
 */
test.describe("Integration: dashboard paused notice", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  const clinicIds: string[] = [];
  let openLinkId = "";
  let pausedLinkId = "";
  let pausedClinicName = "";
  let page: Page;
  const nonce = `pau${Date.now()}`.slice(-12);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Paused ${nonce}`, specialty: "Cardiology" });
    const open = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicIds.push(open.clinicId);
    openLinkId = open.locationId;
    const paused = await seedProfessionalClinic(admin, pro.doctorId, { nonce: `${nonce}p`, district: "Limassol" });
    clinicIds.push(paused.clinicId);
    pausedLinkId = paused.linkId;
    await admin
      .from("professional_clinics")
      .update({ is_primary: false, sort_order: 1, pause_online_bookings: true })
      .eq("id", pausedLinkId);
    const { data } = await admin.from("clinics").select("name").eq("id", paused.clinicId).single();
    pausedClinicName = String(data!.name);
    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, clinicIds);
  });

  const notice = () => page.getByTestId("dashboard-paused-notice");
  const dismissedAt = async () =>
    (await admin.from("professional_clinics").select("pause_notice_dismissed_at").eq("id", pausedLinkId).single()).data!
      .pause_notice_dismissed_at;

  test("shows one line for the paused clinic only, and the x hides it for good", async () => {
    test.setTimeout(120_000);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(notice()).toHaveCount(1, { timeout: 20_000 });
    await expect(notice()).toContainText(`Online bookings are paused at ${pausedClinicName}`);
    // Clinics is not the default settings section, so the link names it.
    await expect(notice().getByRole("link", { name: "Resume in settings" })).toHaveAttribute(
      "href",
      "/settings?section=clinics",
    );

    await expect(async () => {
      await notice().getByRole("button", { name: /Close/ }).click();
      await expect(notice()).toHaveCount(0, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect.poll(dismissedAt, { timeout: 10_000 }).not.toBeNull();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Needs your answer" })).toBeVisible({ timeout: 20_000 });
    await expect(notice()).toHaveCount(0);
  });

  test("comes back when that clinic is paused again", async () => {
    await admin.from("professional_clinics").update({ pause_online_bookings: false }).eq("id", pausedLinkId);
    await admin.from("professional_clinics").update({ pause_online_bookings: true }).eq("id", pausedLinkId);
    expect(await dismissedAt()).toBeNull();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(notice()).toHaveCount(1, { timeout: 20_000 });
  });

  test("the dismiss route only takes her own paused clinic", async ({ request }) => {
    // Not signed in.
    expect((await request.post(`/api/professional-clinics/${pausedLinkId}/dismiss-pause-notice`)).status()).toBe(401);
    // Her open clinic has nothing to dismiss.
    expect((await page.request.post(`/api/professional-clinics/${openLinkId}/dismiss-pause-notice`)).status()).toBe(409);
    // Someone else's link (or none): not found.
    expect(
      (await page.request.post(`/api/professional-clinics/00000000-0000-0000-0000-000000000000/dismiss-pause-notice`)).status(),
    ).toBe(404);
  });
});
