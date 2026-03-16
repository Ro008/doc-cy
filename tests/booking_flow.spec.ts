// tests/booking_flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Booking flow", () => {
  test("full booking flow on doctor profile", async ({ page, request }) => {
    await page.goto("/dr-nikos");

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // 1. Verify doctor's name and address
    await expect(
      page.getByText("Dr. Andreas Nikos", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Evangelismos Private Hospital", { exact: false })
    ).toBeVisible();

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

    // 5. Submit booking
    const submitBtn = page.getByRole("button", {
      name: /Book appointment/i,
    });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 6. Assert success (stable selector; long timeout for API + render in all browsers)
    const successBanner = page.getByTestId("booking-success-message");
    await expect(successBanner).toBeVisible({ timeout: 25000 });

    // 7. Teardown: delete the appointment via API so the slot is free for next runs
    const appointmentId =
      (await successBanner.getAttribute("data-appointment-id")) ?? "";
    expect(appointmentId).not.toBe("");

    const deleteResponse = await request.delete(
      `/api/appointments/${appointmentId}`
    );
    expect(deleteResponse.ok()).toBeTruthy();
  });
});
