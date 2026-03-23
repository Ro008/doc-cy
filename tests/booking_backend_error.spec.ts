import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { skipIfSafeNoBooking } from "./helpers/safeMode";

test.describe("Booking backend errors @booking-creates", () => {
  test("shows requested time outside availability inline", async ({
    page,
  }) => {
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
    let chosenDoctorSlug: string | null = null;

    for (const d of doctors) {
      if (!d?.slug) continue;
      await page.goto(`/${d.slug}`);
      // If the doctor has no published availability yet, BookingSection hides the calendar.
      if (
        await page.getByText("Select a date on the calendar").isVisible()
      ) {
        chosenDoctorSlug = d.slug;
        break;
      }
    }

    test.skip(!chosenDoctorSlug, "No verified doctor with published availability found in Supabase.");

    // Booking steps (same UX path as booking_flow, but we will force a backend error on submit).
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Select a date on the calendar")
    ).toBeVisible({ timeout: 10000 });

    const calendar = page.locator(".rdp-dark");
    const firstAvailableDay = calendar
      .locator("table button:not([disabled])")
      .first();
    await expect(firstAvailableDay).toBeVisible({ timeout: 5000 });
    await firstAvailableDay.click();

    const selectSlotBtn = page.getByRole("button", { name: /Select/i });
    await expect(selectSlotBtn.first()).toBeVisible({ timeout: 5000 });
    await selectSlotBtn.first().click();
    await page.getByRole("button", { name: /Confirm/i }).first().click();

    // Contact form
    const nameInput = page.getByLabel("Full name", { exact: true });
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Error E2E");

    const emailInput = page.getByLabel("Email", { exact: true });
    await expect(emailInput).toBeVisible();
    await emailInput.fill("error.e2e@example.com");

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

    // Force backend error by intercepting the booking request.
    // Using an appointmentLocal outside typical working hours ensures:
    //  - no DB mutation required
    //  - message comes from the same backend path used in production
    const forcedAppointmentLocal = "2099-01-01T23:30";
    await page.route("**/api/appointments", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      const postDataRaw = route.request().postData() ?? "";
      let postBody: any;
      try {
        postBody = JSON.parse(postDataRaw);
      } catch {
        await route.continue();
        return;
      }

      postBody = {
        ...postBody,
        appointmentLocal: forcedAppointmentLocal,
      };

      const response = await route.fetch({
        method: "POST",
        headers: route.request().headers(),
        postData: JSON.stringify(postBody),
      });

      await route.fulfill({ response });
    });

    await page.getByRole("button", { name: /Book appointment/i }).click();

    const errorBox = page.getByTestId("booking-error-message");
    await expect(errorBox).toBeVisible({ timeout: 10000 });
    await expect(errorBox).toContainText(
      "Requested time is outside the professional's availability."
    );

    // Should not navigate to the success page
    await expect(page.getByRole("heading", { name: /Appointment Confirmed!/i })).toHaveCount(0);
  });

  test("shows not accepting public bookings inline", async ({ page }) => {
    skipIfSafeNoBooking(test.info());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Pick a non-verified professional (pending/rejected) to force backend 403.
    const { data: pending } = await supabase
      .from("doctors")
      .select("id,status")
      .eq("status", "pending")
      .limit(5);

    const pendingDoctorId =
      pending?.find((d) => typeof d?.id === "string")?.id ?? null;

    const nonVerifiedDoctorId =
      pendingDoctorId ??
      (
        await supabase
          .from("doctors")
          .select("id,status")
          .eq("status", "rejected")
          .limit(5)
      ).data?.find((d) => typeof d?.id === "string")?.id ??
      null;

    test.skip(
      !nonVerifiedDoctorId,
      "No pending/rejected doctors found in Supabase seed."
    );

    // Pick a verified doctor whose calendar is visible so we can reach the booking form UI.
    const { data: activeDoctors } = await supabase
      .from("doctors")
      .select("slug,name,id")
      .eq("status", "verified")
      .limit(8);

    const doctors = activeDoctors ?? [];
    let chosenDoctorSlug: string | null = null;
    for (const d of doctors) {
      if (!d?.slug) continue;
      await page.goto(`/${d.slug}`);
      if (await page.getByText("Select a date on the calendar").isVisible()) {
        chosenDoctorSlug = d.slug;
        break;
      }
    }

    test.skip(
      !chosenDoctorSlug,
      "No verified doctor with published availability found in Supabase seed."
    );

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Select a date on the calendar")
    ).toBeVisible({ timeout: 10000 });

    const calendar = page.locator(".rdp-dark");
    const firstAvailableDay = calendar
      .locator("table button:not([disabled])")
      .first();
    await expect(firstAvailableDay).toBeVisible({ timeout: 5000 });
    await firstAvailableDay.click();

    const selectSlotBtn = page.getByRole("button", { name: /Select/i });
    await expect(selectSlotBtn.first()).toBeVisible({ timeout: 5000 });
    await selectSlotBtn.first().click();
    await page.getByRole("button", { name: /Confirm/i }).first().click();

    // Contact form
    const nameInput = page.getByLabel("Full name", { exact: true });
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Error E2E 403");

    const emailInput = page.getByLabel("Email", { exact: true });
    await expect(emailInput).toBeVisible();
    await emailInput.fill("error403.e2e@example.com");

    const phoneInput = page.getByRole("textbox", {
      name: /Phone.*priority contact/i,
    });
    await expect(phoneInput).toBeVisible();
    await phoneInput.click();
    await phoneInput.pressSequentially("99123456", { delay: 50 });

    await expect(
      page.getByText(
        /Please enter a valid phone number|double‑check the phone number length/i
      )
    ).toBeHidden({ timeout: 3000 });

    await page.locator("#visitType").selectOption("First Consultation");

    // Force backend: override doctorId to a pending/rejected professional.
    await page.route("**/api/appointments", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      const postDataRaw = route.request().postData() ?? "";
      let postBody: any;
      try {
        postBody = JSON.parse(postDataRaw);
      } catch {
        await route.continue();
        return;
      }

      postBody = {
        ...postBody,
        doctorId: nonVerifiedDoctorId,
      };

      const response = await route.fetch({
        method: "POST",
        headers: route.request().headers(),
        postData: JSON.stringify(postBody),
      });

      await route.fulfill({ response });
    });

    await page.getByRole("button", { name: /Book appointment/i }).click();

    const errorBox = page.getByTestId("booking-error-message");
    await expect(errorBox).toBeVisible({ timeout: 10000 });
    await expect(errorBox).toContainText(
      "This professional is not accepting public bookings yet."
    );

    await expect(
      page.getByRole("heading", { name: /Appointment Confirmed!/i })
    ).toHaveCount(0);
  });
});

