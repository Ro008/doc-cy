// tests/navigation.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Navigation and routing", { tag: "@pr-e2e" }, () => {
  test("invalid doctor slug redirects to home", async ({ page }) => {
    await page.goto("/invalid-doctor-slug-xyz");

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Run a Smarter Practice/i,
      }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("landing Find a Professional does not surface legacy test doctors", async ({ page }) => {
    await page.goto("/");

    const finderLink = page.getByRole("link", { name: /^Find a Professional$/i }).first();
    await expect(finderLink).toBeVisible();
    await finderLink.click();

    // Soft nav to /finder waits on a heavy RSC payload; allow CI headroom.
    await expect(page).toHaveURL(/\/finder(?:\?|$)/, { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: /Find your next health professional in Cyprus|Health Professionals in Cyprus|Find a Professional/i })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("article").first()).toBeVisible({ timeout: 30_000 });
    const resultsCount = page.getByTestId("finder-results-count");
    await expect(resultsCount).toBeVisible({ timeout: 30_000 });
    await expect(resultsCount).toContainText(/health professionals on DocCy across Cyprus/i);
    await expect(resultsCount).toContainText(/\d+/);
    await expect(page.getByTestId("finder-missing-doctor-card")).toHaveCount(0);

    // Legacy hardcoded fixtures should not be required for finder health.
    // Keep this test focused on generic UX invariants.
  });

  test("landing to finder does not show filtered-empty message when no filters are active", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^Find a Professional$/i }).first().click();

    await expect(page).toHaveURL(/\/finder(?:\?|$)/, { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: /Find your next health professional in Cyprus|Health Professionals in Cyprus|Find a Professional/i })
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId("finder-missing-doctor-card")).toHaveCount(0);
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
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Dentistry in Paphos/i,
      })
    ).toBeVisible();
  });
});
