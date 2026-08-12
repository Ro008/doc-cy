// tests/doctor_profile_mobile.spec.ts
import { test, expect } from "@playwright/test";
import { createTestDataClient } from "./helpers/testDataClient";

test.describe("Doctor profile mobile layout", () => {
  test("shows booking above the fold and keeps details collapsed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const supabase = createTestDataClient();
    const { data: activeDoctors } = await supabase
      .from("doctors")
      .select("slug")
      .eq("status", "verified")
      .not("slug", "is", null)
      .limit(5);

    const slug = activeDoctors?.[0]?.slug;
    expect(slug).toBeTruthy();

    await page.goto(`/${slug}`);

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
      name: /About/i,
    });
    await expect(accordionButton).toBeVisible();
    await expect(accordionButton).toHaveAttribute("aria-expanded", "false");

    // Location should now be rendered as a standalone section (outside About accordion).
    await expect(page.getByRole("heading", { name: /^Location$/i })).toBeVisible();
  });
});

