import { test, expect } from "@playwright/test";

/** next-intl surfaces missing keys as literal paths like `LandingPage.Hero.title` */
async function expectNoRawIntlKeys(page: import("@playwright/test").Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/LandingPage\.[A-Za-z]/);
}

test.describe("Landing i18n", () => {
  test("language switcher toggles EN/GR content on landing", async ({
    page,
  }) => {
    await page.goto("/en");

    // English baseline — copy from messages/en.json (not Greek strings)
    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Your Professional Website\s*&\s*Online Agenda/i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /Claim your professional profile/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /Common questions/i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/FOUNDING MEMBERS CLUB/i),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", {
        name: /€19\/month\. Locked for life\./i,
      }),
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("heading", { level: 1, name: /Σταματήστε να κυνηγάτε/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 2, name: /^Συχνές ερωτήσεις$/ }),
    ).toHaveCount(0);
    await expectNoRawIntlKeys(page);

    // Greek — copy from messages/el.json; must not show English FAQ / English-only club badge
    await page.getByRole("link", { name: /^GR$/ }).click();
    await expect(page).toHaveURL(/\/el$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Σταματήστε να κυνηγάτε ραντεβού\.\s*Ξαναπάρτε τον έλεγχο του χρόνου σας\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /Διεκδικήστε το προφίλ σας/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/FOUNDING MEMBERS CLUB/i),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", {
        name: /€19\/μήνα\. Κλειδωμένο για πάντα\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    const pricingEl = page.locator("#founders-pricing-card");
    await expect(pricingEl.getByText(/Ιδρυτικό Μέλος/i)).toBeVisible({ timeout: 10000 });
    await expect(pricingEl.getByText(/Πρώτοι 3 μήνες δωρεάν/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("heading", { level: 2, name: /^Συχνές ερωτήσεις$/ }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { level: 2, name: /Common questions/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Your Professional Website\s*&\s*Online Agenda/i,
      }),
    ).toHaveCount(0);
    await expectNoRawIntlKeys(page);

    // Back to English
    await page.getByRole("link", { name: /^EN$/ }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Your Professional Website\s*&\s*Online Agenda/i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expectNoRawIntlKeys(page);
  });
});
