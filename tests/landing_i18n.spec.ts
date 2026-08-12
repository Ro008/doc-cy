import { test, expect } from "@playwright/test";

/** next-intl surfaces missing keys as literal paths like `LandingPage.Hero.title` */
async function expectNoRawIntlKeys(page: import("@playwright/test").Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/LandingPage\.[A-Za-z]/);
}

test.describe("Landing i18n", { tag: "@pr-e2e" }, () => {
  test("language switcher toggles EN/GR content on landing", async ({
    page,
  }) => {
    await page.goto("/en");

    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Run a Smarter Practice/i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('a[href="#founders-pricing-card"]').first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /Frequently asked questions/i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("FOUNDING MEMBERS CLUB", { exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", {
        name: /€19\/month\. Locked for life\./i,
      }),
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("heading", { level: 1, name: /Μια πιο έξυπνη πρακτική/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 2, name: /^Συχνές ερωτήσεις$/ }),
    ).toHaveCount(0);
    await expectNoRawIntlKeys(page);

    await page.getByRole("link", { name: /^GR$/ }).click();
    await expect(page).toHaveURL(/\/el$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Μια πιο έξυπνη πρακτική/i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('a[href="/register"]').filter({ hasText: /Καταχώρηση πρακτικής/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("FOUNDING MEMBERS CLUB", { exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", {
        name: /€19\/μήνα\. Κλειδωμένο για πάντα\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    const pricingEl = page.locator("#founders-pricing-card");
    await expect(pricingEl.getByText(/Ιδρυτικό Μέλος/i)).toBeVisible({ timeout: 10000 });
    await expect(pricingEl.getByText(/Πρώτοι 6 μήνες δωρεάν/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("heading", { level: 2, name: /^Συχνές ερωτήσεις$/ }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { level: 2, name: /Frequently asked questions/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Run a Smarter Practice/i,
      }),
    ).toHaveCount(0);
    await expectNoRawIntlKeys(page);

    await page.getByRole("link", { name: /^EN$/ }).click();
    await expect(page).toHaveURL(/\/for-professionals\/?$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Run a Smarter Practice/i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expectNoRawIntlKeys(page);
  });
});
