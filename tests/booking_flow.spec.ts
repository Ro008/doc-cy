// tests/booking_flow.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import { skipIfSafeNoBooking } from "./helpers/safeMode";

test.describe("Booking flow @booking-creates", () => {
  test("full booking flow on doctor profile", async ({ page, request }) => {
    skipIfSafeNoBooking(test.info());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: activeDoctors } = await supabase
      .from("doctors")
      .select("slug,name,id")
      .eq("status", "verified")
      .limit(8);

    const doctors = activeDoctors ?? [];
    let chosenDoctor: (typeof doctors)[number] | null = null;

    for (const d of doctors) {
      if (!d?.slug) continue;
      await page.goto(`/${d.slug}`);
      // If the doctor has no published availability yet, BookingSection hides the calendar.
      if (await page.getByText("Select a date on the calendar").isVisible()) {
        chosenDoctor = d;
        break;
      }
    }

    if (!chosenDoctor) {
      throw new Error(
        "No verified doctor with published availability found for E2E."
      );
    }

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // 1. Verify we actually loaded the doctor profile (not the landing page).
    // If the doctor is missing/inactive, the doctor page redirects to "/".
    await expect(page).toHaveURL(new RegExp(`/${chosenDoctor.slug}$`), {
      timeout: 10000,
    });
    await expect(
      page.getByText(/Evangelismos Private Hospital/i)
    ).toBeVisible({ timeout: 10000 });

    // 2. Two-column booking: wait for panel (unique placeholder), then select first available day
    await expect(
      page.getByText("Select a date on the calendar")
    ).toBeVisible({ timeout: 10000 });
    const calendar = page.locator(".rdp-dark");
    const firstAvailableDay = calendar
      .locator("table button:not([disabled])")
      .first();
    await expect(firstAvailableDay).toBeVisible({ timeout: 5000 });
    await firstAvailableDay.click();

    // 3. Select a time slot, then Confirm (use different slot per worker to avoid 409)
    const selectSlotBtn = page.getByRole("button", { name: /Select/i });
    await expect(selectSlotBtn.first()).toBeVisible({ timeout: 5000 });
    const slotIndex = Math.min(
      test.info().parallelIndex ?? 0,
      (await selectSlotBtn.count()) - 1
    );
    await selectSlotBtn.nth(slotIndex).click();
    await page.getByRole("button", { name: /Confirm/i }).first().click();

    // 4. Contact form
    const nameInput = page.getByLabel("Full name", { exact: true });
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Jane Smith");

    const emailInput = page.getByLabel("Email", { exact: true });
    await expect(emailInput).toBeVisible();
    await emailInput.fill("jane.smith@example.com");

    const phoneInput = page.getByRole("textbox", {
      name: /Phone.*priority contact/i,
    });
    await expect(phoneInput).toBeVisible();
    await phoneInput.click();
    await phoneInput.pressSequentially("99123456", { delay: 50 });

    // Wait for phone validation to pass (error message disappears)
    await expect(
      page.getByText(/Please enter a valid phone number|double‑check the phone number length/i)
    ).toBeHidden({ timeout: 3000 });

    await page.locator("#visitType").selectOption("First Consultation");

    // 5. Submit booking
    const submitBtn = page.getByRole("button", {
      name: /Book appointment/i,
    });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 6. Assert success page + extract appointmentId for teardown
    // If another worker books the same slot between selection and insert,
    // the UI shows an inline 409 error and we need to retry with a different slot.
    const successUrlRegex = new RegExp(
      `/${chosenDoctor.slug}/success\\?appointmentId=`
    );

    try {
      await page.waitForURL(successUrlRegex, { timeout: 25000 });
    } catch {
      await expect(page.getByTestId("booking-error-message")).toBeVisible({
        timeout: 5000,
      });

      const changeTimeBtn = page.getByRole("button", { name: /Change time/i });
      await expect(changeTimeBtn).toBeVisible({ timeout: 10000 });
      await changeTimeBtn.click();

      const selectButtons = page.getByRole("button", { name: /Select/i });
      const count = await selectButtons.count();
      expect(count).toBeGreaterThan(0);

      await selectButtons.nth((slotIndex + 1) % count).click();
      await page.getByRole("button", { name: /Confirm/i }).first().click();
      await page.locator("#visitType").selectOption("First Consultation");
      await page.getByRole("button", { name: /Book appointment/i }).click();

      await page.waitForURL(successUrlRegex, { timeout: 25000 });
    }
    await expect(
      page.getByRole("heading", { name: /Appointment Confirmed!/i })
    ).toBeVisible({ timeout: 10000 });

    const url = new URL(page.url());
    const appointmentId = url.searchParams.get("appointmentId") ?? "";
    expect(appointmentId).not.toBe("");

    // 7. Validate ICS download on success page
    const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
    const downloadLink = page.getByRole("link", { name: /Download \.ics/i });
    await expect(downloadLink).toBeVisible({ timeout: 5000 });
    await downloadLink.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      `appointment-${appointmentId}.ics`
    );

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const icsText = await fs.readFile(downloadPath as string, "utf8");
    expect(icsText).toContain("BEGIN:VCALENDAR");
    expect(icsText).toContain("END:VCALENDAR");
    expect(icsText).toContain(`UID:${appointmentId}@doccy`);

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from("appointments").delete().eq("id", appointmentId);
    }
  });
});
