import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_BOOKING_DOMAIN = "@test-doccy.com.cy";

test.describe("Prod smoke: appointment booking flow", () => {
  test("guest can book and cleanup removes created data", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const doctorSlug = process.env.TEST_BOOKING_DOCTOR_SLUG ?? "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production."
    );
    test.skip(!doctorSlug, "Missing TEST_BOOKING_DOCTOR_SLUG.");
    test.skip(!supabaseUrl || !serviceRole, "Missing Supabase service credentials.");

    const admin = createClient(supabaseUrl, serviceRole);
    const nonce = `${Date.now()}`;
    const patientName = `Prod Booking ${nonce}`;
    const patientEmail = `test-booking-${nonce}${TEST_BOOKING_DOMAIN}`;
    let appointmentId = "";

    try {
      await page.goto(`/${doctorSlug}`);
      await expect(page.getByText("Select a date on the calendar")).toBeVisible({
        timeout: 20000,
      });

      const calendar = page.locator(".rdp-dark");
      const firstAvailableDay = calendar.locator("table button:not([disabled])").first();
      await expect(firstAvailableDay).toBeVisible({ timeout: 10000 });
      await firstAvailableDay.click();

      const selectSlotBtn = page.getByRole("button", { name: /Select/i }).first();
      await expect(selectSlotBtn).toBeVisible({ timeout: 10000 });
      await selectSlotBtn.click();
      await page.getByRole("button", { name: /Confirm/i }).first().click();

      await page.getByLabel("Full name", { exact: true }).fill(patientName);
      await page.getByLabel("Email", { exact: true }).fill(patientEmail);
      const phoneInput = page.getByRole("textbox", {
        name: /Phone.*priority contact/i,
      });
      await phoneInput.fill("99123456");
      await page.locator("#visitType").selectOption("First Consultation");
      await page.getByRole("button", { name: /Book appointment/i }).click();

      await page.waitForURL(new RegExp(`/${doctorSlug}/success\\?appointmentId=`), {
        timeout: 30000,
      });
      await expect(
        page.getByRole("heading", { name: /Appointment Confirmed!/i })
      ).toBeVisible({
        timeout: 10000,
      });

      appointmentId = new URL(page.url()).searchParams.get("appointmentId") ?? "";
      expect(appointmentId).not.toBe("");
    } finally {
      // Critical cleanup: keep real doctor's agenda clean.
      if (appointmentId) {
        await admin.from("appointments").delete().eq("id", appointmentId);
      }
      await admin.from("appointments").delete().eq("patient_email", patientEmail);
      // Best effort in case a dedicated patient table exists in some environments.
      try {
        await admin.from("patients").delete().eq("email", patientEmail);
      } catch {
        // no-op: table may not exist in all environments
      }
    }
  });
});

