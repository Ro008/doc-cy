// tests/navigation.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Navigation and routing", { tag: ["@pr-e2e", "@pr-e2e-finder"] }, () => {
  test("invalid doctor slug redirects to patient home (finder)", async ({ page }) => {
    await page.goto("/invalid-doctor-slug-xyz");

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /The most complete health directory in Cyprus|Cyprus['’]s most complete health directory|Find your next health professional(?: in Cyprus)?|Health Professionals in Cyprus|Find a Professional/i,
      }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("for-professionals Find a Professional opens patient home", async ({ page }) => {
    await page.goto("/for-professionals");

    const finderLink = page.getByRole("link", { name: /^Find a Professional$/i }).first();
    await expect(finderLink).toBeVisible();
    await finderLink.click();

    await expect(page).toHaveURL(/^https?:\/\/[^/?#]+\/?(?:\?.*)?$/, { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: /The most complete health directory in Cyprus|Cyprus['’]s most complete health directory|Find your next health professional(?: in Cyprus)?|Health Professionals in Cyprus|Find a Professional/i })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("article").first()).toBeVisible({ timeout: 30_000 });
    const resultsCount = page.getByTestId("finder-results-count");
    await expect(resultsCount).toBeVisible({ timeout: 30_000 });
    await expect(resultsCount).toContainText(/health professionals on DocCy across Cyprus/i);
    await expect(resultsCount).toContainText(/\d+/);
    await expect(page.getByTestId("finder-missing-doctor-card")).toHaveCount(0);
  });

  test("patient home without filters does not show filtered-empty message", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/^https?:\/\/[^/?#]+\/?(?:\?.*)?$/, { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: /The most complete health directory in Cyprus|Cyprus['’]s most complete health directory|Find your next health professional(?: in Cyprus)?|Health Professionals in Cyprus|Find a Professional/i })
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId("finder-missing-doctor-card")).toHaveCount(0);
  });

  test("finder pricing CTA jumps to for-professionals founders pricing section", async ({ page }) => {
    await page.goto("/");

    const pricingCta = page
      .getByRole("link", { name: /claim your professional profile|list your practice/i })
      .first();
    await expect(pricingCta).toBeVisible();
    await pricingCta.click();

    await expect(page).toHaveURL(/\/for-professionals#founders-pricing$/);

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

  test("finder pricing CTA jumps to for-professionals founders pricing on mobile", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("Mobile"),
      "Mobile-specific coverage only."
    );

    await page.goto("/");

    const pricingCta = page
      .getByRole("link", { name: /claim your professional profile|list your practice/i })
      .first();
    await expect(pricingCta).toBeVisible();
    await pricingCta.click();

    await expect(page).toHaveURL(/\/for-professionals#founders-pricing$/);

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
    await page.goto("/");

    const dentistsQuickLink = page.getByRole("link", { name: "Dentists in Paphos" });
    await expect(dentistsQuickLink).toBeVisible();
    await dentistsQuickLink.click();

    await expect(page).toHaveURL(/\/paphos\/dentist(?:\?|$)/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Dentist in Paphos/i,
      })
    ).toBeVisible();
  });

  test("legacy /finder filter URLs redirect to public paths", async ({ page }) => {
    await page.goto("/finder/paphos/dentistry");
    await expect(page).toHaveURL(/\/paphos\/dentistry(?:\?|$)/);
  });

  test("clinics search is reachable from homepage toggle and footer", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByTestId("finder-audience-toggle");
    await expect(toggle).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/clinics(?:\?|$)/, { timeout: 30_000 }),
      toggle.getByRole("link", { name: /^Clinics$/i }).click(),
    ]);
    await expect(page.getByRole("heading", { level: 1, name: /The largest directory of clinics in Cyprus|The largest clinic directory in Cyprus|Find clinics in Cyprus/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Search by clinic name/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Clinic near me/i })).toBeVisible();

    await page.goto("/for-professionals");
    await Promise.all([
      page.waitForURL(/\/clinics(?:\?|$)/, { timeout: 30_000 }),
      page.getByRole("link", { name: /^Find a Clinic$/i }).click(),
    ]);
  });
});
