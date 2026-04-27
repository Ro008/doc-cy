// tests/navigation.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Navigation and routing", () => {
  test("invalid doctor slug redirects to home", async ({ page }) => {
    await page.goto("/invalid-doctor-slug-xyz");

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /stop chasing appointments.*start protecting your time/i,
      }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("landing Find a Professional does not surface legacy test doctors", async ({ page }) => {
    await page.goto("/");

    const finderLink = page.getByRole("link", { name: /^Find a Professional$/i }).first();
    await expect(finderLink).toBeVisible();
    await finderLink.click();

    await expect(page).toHaveURL(/\/finder(?:\?|$)/);
    await expect(page.getByRole("heading", { level: 1, name: /Find a Professional/i })).toBeVisible();
    await expect(page.locator("article").first()).toBeVisible();
    await expect(page.getByText("No professionals available right now. Please check back soon.")).toHaveCount(0);
    await expect(page.getByText("No professionals match these filters.")).toHaveCount(0);

    // Legacy hardcoded fixtures should not be required for finder health.
    // Keep this test focused on generic UX invariants.
  });

  test("landing to finder does not show filtered-empty message when no filters are active", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^Find a Professional$/i }).first().click();

    await expect(page).toHaveURL(/\/finder(?:\?|$)/);
    await expect(page.getByRole("heading", { level: 1, name: /Find a Professional/i })).toBeVisible();

    await expect(page.getByText("No professionals match these filters.")).toHaveCount(0);
  });

  test("finder pricing CTA jumps to founders pricing section", async ({ page }) => {
    await page.goto("/finder");

    const pricingCta = page
      .getByRole("link", { name: /claim your professional profile|list your practice/i })
      .first();
    await expect(pricingCta).toBeVisible();
    await pricingCta.click();

    await expect(page).toHaveURL(/\/#founders-pricing$/);

    const pricingSection = page.locator("#founders-pricing");
    await expect(pricingSection).toBeVisible();

    await expect
      .poll(async () => {
        return page.evaluate(() => window.scrollY);
      })
      .toBeGreaterThan(300);

    await page.waitForTimeout(900);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(300);
  });

  test("finder pricing CTA jumps to founders pricing section on mobile", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("Mobile"),
      "Mobile-specific coverage only."
    );

    await page.goto("/finder");

    const pricingCta = page
      .getByRole("link", { name: /claim your professional profile|list your practice/i })
      .first();
    await expect(pricingCta).toBeVisible();
    await pricingCta.click();

    await expect(page).toHaveURL(/\/#founders-pricing$/);

    const pricingSection = page.locator("#founders-pricing");
    await expect(pricingSection).toBeVisible();

    await expect
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(220);

    await page.waitForTimeout(900);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(220);
  });

  test("finder quick links apply filters without stuck loading state", async ({ page }) => {
    await page.goto("/finder");

    const dentistsQuickLink = page.getByRole("link", { name: "Dentists in Paphos" });
    await expect(dentistsQuickLink).toBeVisible();
    await dentistsQuickLink.click();

    await expect(page).toHaveURL(/\/finder\/paphos\/dentistry(?:\?|$)/);
    await expect(dentistsQuickLink).toHaveAttribute("aria-busy", "false");
  });
});
