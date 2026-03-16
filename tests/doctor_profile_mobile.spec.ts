// tests/doctor_profile_mobile.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Doctor profile mobile layout", () => {
  test("shows booking above the fold and keeps details collapsed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/dr-nikos");

    // Doctor name visible
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // Booking panel should be visible without scrolling far
    const bookingHeading = page.getByRole("heading", {
      name: /Book an appointment/i,
      level: 2,
    });
    await expect(bookingHeading).toBeVisible({ timeout: 10000 });

    // Accordion button for details exists and is collapsed by default
    const accordionButton = page.getByRole("button", {
      name: /About Dr\./i,
    });
    await expect(accordionButton).toBeVisible();
    await expect(accordionButton).toHaveAttribute("aria-expanded", "false");
  });
});

