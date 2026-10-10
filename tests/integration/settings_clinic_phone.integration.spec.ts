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
 * Settings → Clinics, the clinic phone (user, 2026-10-10): each clinic card shows its
 * phone, well formatted, with its own "Request phone change", as the address has its own. She types
 * the new number (a Cyprus landline or mobile, grouped as she types) and sends it to
 * DocCy: founders approve every clinic phone change, however many people work there.
 * The request uses the clinic change contract (POST /api/clinic-change-requests, backend
 * pending). The Contact & phone section is gone, and its old links land on Clinics.
 */
test.describe("Integration: settings clinic phone", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let page: Page;
  const nonce = `cph${Date.now()}`.slice(-12);
  const digits = String(Date.now()).slice(-6);
  const startPhone = `22${digits}`;
  const newPhone = `99${digits}`;
  const clinicName = `Own Clinic ${nonce}`;
  const clinicIds: string[] = [];
  let clinicId = "";
  let linkId = "";

  const grouped = (phone: string) => `${phone.slice(0, 2)} ${phone.slice(2)}`;
  const shown = (phone: string) => `+357 ${grouped(phone)}`;
  const card = () => page.getByTestId("settings-clinic-card").filter({ hasText: clinicName });
  const requestLink = () => card().getByRole("button", { name: /^Request (phone change|your phone)$/ });
  const input = () => card().getByLabel("New clinic phone");
  const send = () => card().getByRole("button", { name: "Send request" });
  const phoneInDb = async () =>
    (await admin.from("clinics").select("phone").eq("id", clinicId).single()).data!.phone;
  const openField = async () => {
    await page.goto("/settings?section=clinics", { waitUntil: "domcontentloaded" });
    await expect(card()).toContainText(shown(startPhone), { timeout: 20_000 });
    // A click before hydration does nothing: retry until the field opens.
    await expect(async () => {
      await requestLink().click();
      await expect(input()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  };

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Clinic phone ${nonce}`, specialty: "Cardiology" });
    const own = await openPrimaryClinicForBookings(admin, pro.doctorId, nonce);
    clinicId = own.clinicId;
    linkId = own.locationId;
    clinicIds.push(own.clinicId);
    await admin.from("clinics").update({ name: clinicName, phone: startPhone }).eq("id", own.clinicId);

    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, clinicIds);
  });

  test("the clinic card shows its phone with its own Request phone change", async () => {
    await page.goto("/settings?section=clinics", { waitUntil: "domcontentloaded" });
    await expect(card()).toContainText(shown(startPhone), { timeout: 20_000 });
    await expect(requestLink()).toBeVisible();
    await expect(requestLink()).toHaveText("Request phone change");
    // The address keeps its own.
    await expect(card().getByRole("button", { name: "Request name or address change" })).toBeVisible();
  });

  test("Contact & phone is gone; its old links land on Clinics", async () => {
    await page.goto("/settings?section=contact", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Clinics" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Contact & phone" })).toHaveCount(0);
    await expect(page.getByTestId("settings-clinic-phones")).toHaveCount(0);
  });

  test("only a different Cyprus landline or mobile can be sent", async () => {
    await openField();
    // It opens on the current number, grouped; nothing to send yet.
    await expect(input()).toHaveValue(grouped(startPhone));
    await expect(send()).toBeDisabled();

    await input().fill("80001234");
    await expect(send()).toBeDisabled();
    await expect(card().getByRole("alert")).toContainText("A Cyprus landline or mobile");

    await input().fill(`+357${newPhone}`);
    await expect(input()).toHaveValue(grouped(newPhone));
    await expect(send()).toBeEnabled();

    await card().getByRole("button", { name: "Cancel" }).click();
    await expect(input()).toHaveCount(0);
    await expect(card()).toContainText(shown(startPhone));
  });

  test("until the backend exists, sending says so and changes nothing", async () => {
    await openField();
    await input().fill(newPhone);
    await send().click();
    await expect(page.getByText(/Expected to fail for now/)).toBeVisible({ timeout: 20_000 });
    await expect(card()).not.toContainText("Change in review");
    expect(await phoneInDb()).toBe(startPhone);
  });

  test("she sends the new phone to DocCy: the card says it is in review", async () => {
    let sent: unknown = null;
    await page.route("**/api/clinic-change-requests", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ request: { createdAt: new Date().toISOString() } }),
      });
    });
    try {
      await openField();
      await input().fill(newPhone);
      await expect(input()).toHaveValue(grouped(newPhone));
      await send().click();

      await expect(page.getByText("Request sent. We’ll email you once it’s reviewed.")).toBeVisible({ timeout: 20_000 });
      expect(sent).toEqual({ locationId: linkId, changes: { phone: newPhone } });
      await expect(input()).toHaveCount(0);
      await expect(card()).toContainText("Change in review");
      await expect(card()).toContainText(`phone ${shown(newPhone)}`);
      // The live phone stays until DocCy approves; one request at a time.
      await expect(card()).toContainText(shown(startPhone));
      await expect(requestLink()).toHaveCount(0);
      expect(await phoneInDb()).toBe(startPhone);
    } finally {
      await page.unroute("**/api/clinic-change-requests");
    }
  });
});
