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
 * Desktop week view (user, 2026-10-04): Monday to Sunday, and a day is greyed out only when
 * none of her clinics opens that day (one agenda covers all her clinics).
 */
test.describe("Integration: agenda closed days", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  const clinicIds: string[] = [];
  let page: Page;
  const nonce = `acd${Date.now()}`.slice(-12);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Closed Days ${nonce}`, specialty: "Cardiology" });
    // Seeded clinics open Monday to Friday.
    const seeded = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicIds.push(seeded.clinicId);
    page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, clinicIds);
  });

  const columns = () => page.locator('[data-testid="agenda-day-column"][data-view="desktop"]');
  const closedWeekdays = async () =>
    columns().evaluateAll((els) =>
      els.filter((el) => el.getAttribute("data-closed") === "true").map((el) => el.getAttribute("data-weekday")),
    );

  test("shows seven days and greys the weekend when her only clinic is closed then", async () => {
    await page.goto("/agenda?view=week", { waitUntil: "domcontentloaded" });
    await expect(columns()).toHaveCount(7, { timeout: 20_000 });
    expect(await closedWeekdays()).toEqual(["saturday", "sunday"]);
  });

  test("a second clinic open on Saturday un-greys Saturday only", async () => {
    const second = await seedProfessionalClinic(admin, pro!.doctorId, { nonce: `${nonce}s`, district: "Limassol" });
    clinicIds.push(second.clinicId);
    const { error } = await admin
      .from("professional_clinics")
      .update({
        is_primary: false,
        sort_order: 1,
        saturday: true,
        weekly_schedule: {
          monday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
          tuesday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
          wednesday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
          thursday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
          friday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
          saturday: { enabled: true, start_time: "09:00:00", end_time: "13:00:00" },
          sunday: { enabled: false, start_time: "09:00:00", end_time: "13:00:00" },
        },
      })
      .eq("id", second.linkId);
    expect(error).toBeNull();

    await page.goto("/agenda?view=week", { waitUntil: "domcontentloaded" });
    await expect(columns()).toHaveCount(7, { timeout: 20_000 });
    await expect.poll(closedWeekdays, { timeout: 20_000 }).toEqual(["sunday"]);
  });
});
