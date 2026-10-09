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

const CY = "Europe/Nicosia";
const cyDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: CY }).format(new Date(ms));

/** A quarter-hour start `offsetMinutes` from now, or null when it falls outside today in Cyprus. */
function todayAt(offsetMinutes: number): string | null {
  const step = 15 * 60_000;
  const ms = Math.round((Date.now() + offsetMinutes * 60_000) / step) * step;
  return cyDay(ms) === cyDay(Date.now()) ? new Date(ms).toISOString() : null;
}

/**
 * Today's visits on the dashboard open the same details window as the agenda
 * (user, 2026-10-09), without leaving the dashboard.
 */
test.describe("Integration: visit details from the dashboard", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let pro: TestDoctorFixture | null = null;
  let clinicId = "";
  let page: Page;
  const nonce = `dvd${Date.now()}`.slice(-12);

  test.beforeAll(async ({ browser }) => {
    admin = createIntegrationAdmin(requireSafeIntegration());
    pro = await createTestDoctor({ admin, nonce, name: `Visit Details ${nonce}`, specialty: "Cardiology" });
    clinicId = (await openPrimaryClinicForBookings(admin, pro.doctorId, nonce)).clinicId;
    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginDoctorUi(page, pro.email, pro.password);
  });

  test.afterAll(async () => {
    await page?.close();
    if (pro) await deleteTestDoctor(pro);
    await deleteTestClinics(admin, [clinicId]);
  });

  async function visit(tag: string, startIso: string) {
    const { data, error } = await admin
      .from("appointments")
      .insert({
        professional_id: pro!.doctorId,
        clinic_id: clinicId,
        booking_source: "online",
        patient_name: `Today ${tag} ${nonce}`,
        patient_email: `today-${tag}-${nonce}@integration.test`,
        patient_phone: "+35799444555",
        patient_gender: "female",
        patient_birthdate: "1990-05-17",
        is_new_patient: true,
        reason: "Integration: dashboard visit details",
        appointment_datetime: startIso,
        duration_minutes: 30,
        status: "CONFIRMED",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`seed visit: ${error?.message}`);
    return String(data.id);
  }

  async function openFromDashboard(name: string) {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const item = page.getByTestId("dashboard-today-appointment").filter({ hasText: name });
    await expect(item).toBeVisible({ timeout: 20_000 });
    const details = page.getByTestId("agenda-visit-patient");
    // Clicks before hydration are lost: retry until the window opens.
    await expect(async () => {
      await item.getByRole("button", { name: new RegExp(name) }).click();
      await expect(details).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    return page.getByRole("dialog");
  }

  test("a visit later today opens its details on the dashboard, with cancel", async () => {
    const startIso = todayAt(90);
    test.skip(!startIso, "Too late in the Cyprus day for a visit later today.");
    await visit("later", startIso!);

    const dialog = await openFromDashboard(`Today later ${nonce}`);
    await expect(dialog.getByRole("heading", { name: `Today later ${nonce}` })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "+35799444555" })).toHaveAttribute("href", "tel:+35799444555");
    await expect(dialog.getByText("Integration: dashboard visit details")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Cancel appointment$/i })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard(?:[?#]|$)/);

    await dialog.getByRole("button", { name: "Close" }).last().click();
    await expect(page.getByTestId("agenda-visit-patient")).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard(?:[?#]|$)/);
  });

  test("a visit earlier today can be marked as a no-show from the dashboard", async () => {
    const startIso = todayAt(-120);
    test.skip(!startIso, "Too early in the Cyprus day for a visit earlier today.");
    const id = await visit("earlier", startIso!);

    const dialog = await openFromDashboard(`Today earlier ${nonce}`);
    await expect(dialog.getByText("Past visit", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Your notes", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Mark as no-show" }).click();
    await expect(dialog.getByRole("button", { name: "Undo no-show" })).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const { data } = await admin.from("appointments").select("attendance").eq("id", id).maybeSingle();
        return data?.attendance ?? null;
      }, { timeout: 15_000 })
      .toBe("no_show");
  });

  test("cancelling from the dashboard takes the visit off today's list", async () => {
    const startIso = todayAt(150);
    test.skip(!startIso, "Too late in the Cyprus day for a visit later today.");
    const id = await visit("cancel", startIso!);

    const dialog = await openFromDashboard(`Today cancel ${nonce}`);
    await dialog.getByRole("button", { name: /^Cancel appointment$/i }).click();
    await dialog.getByRole("textbox").fill("Integration: cancelled from the dashboard.");
    await dialog.getByRole("button", { name: /Cancel & notify|Cancel visit/ }).click();

    await expect(page.getByTestId("agenda-visit-patient")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId("dashboard-today-appointment").filter({ hasText: `Today cancel ${nonce}` })).toHaveCount(
      0,
      { timeout: 20_000 },
    );
    const { data } = await admin.from("appointments").select("status").eq("id", id).maybeSingle();
    expect(String(data?.status ?? "").toUpperCase()).toBe("CANCELLED");
  });
});
