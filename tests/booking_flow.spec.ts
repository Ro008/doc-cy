// tests/booking_flow.spec.ts
import { test, expect } from "@playwright/test";
import { fillVisitReason } from "./helpers/fillVisitReason";
import { createClient } from "@supabase/supabase-js";
import { pickFirstAvailableBookingDay } from "./helpers/pickBookingCalendarDay";
import { skipIfSafeNoBooking } from "./helpers/safeMode";
import { createTestDataClient } from "./helpers/testDataClient";
import { takeOverLatestDraftLink } from "./integration/helpers/online-booking";

test.describe("Booking flow @booking-creates", { tag: ["@pr-e2e", "@pr-e2e-booking"] }, () => {
  test("full booking flow on doctor profile", async ({ page, request }) => {
    test.setTimeout(120_000);
    skipIfSafeNoBooking(test.info());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    expect(supabaseUrl).not.toBe("");

    const supabase = createTestDataClient();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const admin = serviceKey ? createClient(supabaseUrl, serviceKey) : null;
    const { data: activeDoctors } = await supabase
      .from("professionals")
      .select("slug,name,id")
      .eq("is_registered", true)
      .not("slug", "is", null)
      .limit(8);

    const doctors = activeDoctors ?? [];
    let chosenDoctor: (typeof doctors)[number] | null = null;

    for (const d of doctors) {
      if (!d?.slug) continue;
      await page.goto(`/en/${d.slug}`);
      if (!(await page.getByText("Select a date on the calendar").isVisible())) {
        continue;
      }
      try {
        await pickFirstAvailableBookingDay(page, { doctorHint: d.slug });
        chosenDoctor = d;
        break;
      } catch {
        // Next doctor — calendar visible but no clickable day in horizon.
      }
    }

    if (!chosenDoctor) {
      test.skip(
        true,
        "No verified doctor with a bookable calendar day found in this environment."
      );
    }

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // 1. Verify we actually loaded the doctor profile (not the landing page).
    // If the doctor is missing/inactive, the doctor page redirects to "/".
    await expect(page).toHaveURL(new RegExp(`/en/${chosenDoctor.slug}(?:/)?$`), {
      timeout: 10000,
    });
    // Avoid hardcoding clinic branding text; it may vary across environments.
    // URL + booking widget visibility below is the stable profile assertion.

    // 2. Calendar day already selected while probing doctors above.

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

    // A test address: the confirmation link is never really emailed.
    const patientEmail = `booking-flow-${Date.now()}-${test.info().parallelIndex}@integration.test`;
    const emailInput = page.getByLabel("Email", { exact: true });
    await expect(emailInput).toBeVisible();
    await emailInput.fill(patientEmail);

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

    await page.getByRole("radio", { name: /This is my first visit/i }).check();
    await page.getByRole("radio", { name: /Prefer not to say/i }).check();
    await page.locator("#patientBirthdate").fill("1990-01-01");

    await fillVisitReason(page, "Routine check-up — E2E booking flow.");

    // 5. Submit booking
    const submitBtn = page.getByRole("button", {
      name: /Send booking request/i,
    });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 6. The form doesn't book yet: the patient is asked to confirm by email (user, 2026-10-02).
    const success = page.getByTestId("booking-success-message");
    await expect(success).toBeVisible({ timeout: 25000 });
    await expect(success).toContainText(/Check your email/i);
    await expect(success).toContainText(patientEmail);

    // 7. The emailed link (its token swapped for a known one) opens "Confirm my request".
    test.skip(!admin, "SUPABASE_SERVICE_ROLE_KEY is needed to open the confirmation link.");
    let appointmentId: string | null = null;
    try {
      const token = await takeOverLatestDraftLink(admin!, patientEmail);
      await page.goto(`/booking/confirm?token=${encodeURIComponent(token)}`);
      const confirmBtn = page.getByRole("button", { name: /Confirm my request/i });
      await expect(confirmBtn).toBeVisible({ timeout: 20000 });
      await confirmBtn.click();
      await expect(page.getByTestId("booking-confirm-sent")).toBeVisible({ timeout: 20000 });

      // 8. Now it's a request waiting for the professional.
      const { data: rows } = await admin!
        .from("appointments")
        .select("id, status, booking_source")
        .eq("patient_email", patientEmail);
      expect(rows).toHaveLength(1);
      appointmentId = String(rows![0].id);
      expect(rows![0].status).toBe("REQUESTED");
      expect(rows![0].booking_source).toBe("online");
    } finally {
      if (admin) {
        await admin.from("appointment_drafts").delete().eq("patient_email", patientEmail);
        if (appointmentId) await admin.from("appointments").delete().eq("id", appointmentId);
      }
    }
  });
});
