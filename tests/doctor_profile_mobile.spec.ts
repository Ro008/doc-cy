// tests/doctor_profile_mobile.spec.ts
import { test, expect } from "@playwright/test";
import { createTestDataClient } from "./helpers/testDataClient";

test.describe("Doctor profile mobile layout", () => {
  test("shows booking near the top and every section on the same page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const supabase = createTestDataClient();
    const { data: activeDoctors } = await supabase
      .from("professionals")
      .select("slug")
      .eq("is_registered", true)
      .not("slug", "is", null)
      .limit(5);

    const slug = activeDoctors?.[0]?.slug;
    expect(slug).toBeTruthy();

    await page.goto(`/${slug}`);

    // Doctor name visible
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // Anchor tabs instead of separate pages or a collapsed accordion
    const nav = page.getByRole("navigation", { name: "Profile sections" });
    await expect(nav.getByRole("link", { name: "Book" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "About" })).toBeVisible();

    // Booking panel is part of the page
    await expect(
      page.getByRole("heading", { name: /Book an appointment/i, level: 2 })
    ).toBeAttached({ timeout: 10000 });

    // The bio is shown openly: no "About" accordion button any more
    await expect(page.getByRole("heading", { name: /^About /, level: 2 })).toBeAttached();
    await expect(page.locator("[aria-controls='doctor-details-panel']")).toHaveCount(0);
  });
});
