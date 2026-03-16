// tests/doctor_break_slots.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Doctor lunch/break time", () => {
  test("break window hides slots between 14:00 and 16:00", async ({ page }) => {
    // 1. Configure a daily break via the dashboard settings UI
    await page.goto("/dashboard/settings");

    await expect(
      page.getByRole("heading", { name: /Working hours & availability/i })
    ).toBeVisible({ timeout: 10000 });

    const breakCheckbox = page.getByRole("checkbox", {
      name: /Add a daily break/i,
    });
    await breakCheckbox.check();

    const breakStartInput = page.getByLabel("Break start");
    const breakEndInput = page.getByLabel("Break end");

    await breakStartInput.fill("14:00");
    await breakEndInput.fill("16:00");

    const saveButton = page.getByRole("button", {
      name: /Save settings/i,
    });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(
      page.getByText(/Settings saved\./i)
    ).toBeVisible({ timeout: 10000 });

    // 2. Go to doctor profile and verify no slots are shown in 14:00–16:00
    await page.goto("/dr-nikos");

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // Select first available date in the calendar
    await expect(
      page.getByText("Select a date on the calendar")
    ).toBeVisible({ timeout: 10000 });

    const calendar = page.locator(".rdp-dark");
    const firstAvailableDay = calendar
      .locator("table button:not([disabled])")
      .first();
    await expect(firstAvailableDay).toBeVisible({ timeout: 5000 });
    await firstAvailableDay.click();

    // Wait for slots to load
    const selectButtons = page.getByRole("button", { name: /Select/i });
    await expect(selectButtons.first()).toBeVisible({ timeout: 10000 });

    // Assert that no slot label contains 14:00/14:30/15:00/15:30
    for (const t of ["14:00", "14:30", "15:00", "15:30"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(t) })
      ).toHaveCount(0);
    }
  });
});

