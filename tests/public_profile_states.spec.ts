import { test, expect } from "@playwright/test";
import { createTestDataClient } from "./helpers/testDataClient";

test.describe("Public profile states", () => {
  test.beforeAll(() => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").not.toBe("");
    expect(
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim() ||
        (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
    ).not.toBe("");
  });

  test("registered: shows live profile + booking calendar", async ({
    page,
  }) => {
    const supabase = createTestDataClient();
    const { data } = await supabase
      .from("professionals")
      .select("slug")
      .eq("is_registered", true)
      .not("slug", "is", null)
      .limit(12);

    const candidates = data ?? [];
    let chosenSlug: string | null = null;

    for (const d of candidates) {
      const slug = d?.slug;
      if (!slug) continue;

      await page.goto(`/${slug}`);

      // If the doctor has no published availability, BookingSection hides the calendar.
      if (await page.getByText("Select a date on the calendar").isVisible()) {
        chosenSlug = slug;
        break;
      }
    }

    test.skip(!chosenSlug, "No verified doctor with published availability found for E2E.");

    await expect(page.getByRole("heading", { name: /Book an appointment/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Profile under review")).toHaveCount(0);
    await expect(page.locator("text=Profile unavailable")).toHaveCount(0);
  });
});

