// tests/brand_consistency.spec.ts
import { test, expect } from "@playwright/test";
import { createTestDataClient } from "./helpers/testDataClient";

test.describe("Brand consistency", () => {
  test("landing page shows DocCy logo in header, not DOCCY text", async ({
    page,
  }) => {
    await page.goto("/en");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Run a Smarter Practice/i,
      }),
    ).toBeVisible({ timeout: 10000 });

    const brandLogo = page.locator("header").first().getByRole("img", {
      name: "DocCy",
    });
    await expect(brandLogo).toBeVisible();
    await expect(brandLogo).toHaveAttribute("src", /doccy-logo\.png/);

    const brandContainer = page.locator("header").first();
    await expect(brandContainer).not.toContainText("DOCCY");
  });

  test("professional profile shows DocCy logo, not DOCCY text", async ({
    page,
  }) => {
    const supabase = createTestDataClient();
    const { data: activeDoctors } = await supabase
      .from("doctors")
      .select("slug")
      .eq("status", "verified")
      .not("slug", "is", null)
      .limit(5);

    const firstSlug = activeDoctors?.[0]?.slug;
    if (!firstSlug) throw new Error("No verified doctors found for E2E test.");

    await page.goto(`/${firstSlug}`);

    // Ensure we didn't get redirected to "/" (doctor missing/inactive)
    await expect(page).toHaveURL(new RegExp(`/${firstSlug}$`), {
      timeout: 10000,
    });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10000,
    });

    const brandLogo = page.getByRole("img", { name: "DocCy" });
    await expect(brandLogo).toBeVisible();
    await expect(brandLogo).toHaveAttribute("src", /doccy-logo\.png/);

    await expect(page.getByText(/Professional profile/i)).toBeVisible();
    await expect(page.locator("main")).not.toContainText("DOCCY");
  });
});
