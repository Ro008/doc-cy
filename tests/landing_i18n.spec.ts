import { test, expect } from "@playwright/test";

test.describe("Landing i18n", () => {
  test("language switcher toggles EN/GR content on landing", async ({
    page,
  }) => {
    await page.goto("/en");

    // English baseline
    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Stop chasing appointments\.\s*Start protecting your time\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /Claim your professional profile/i }),
    ).toBeVisible({ timeout: 10000 });

    // Toggle to Greek
    await page.getByRole("link", { name: "GR" }).click();
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
      page.getByText(/ΓΙΝΕΤΕ ΜΕΛΟΣ ΤΟΥ DOCCY FOUNDERS CLUB/i),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/Ιδρυτικό Μέλος|Κανονική Τιμολόγηση/i),
    ).toBeVisible({ timeout: 10000 });

    // Back to English
    await page.getByRole("link", { name: "EN" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Stop chasing appointments\.\s*Start protecting your time\./i,
      }),
    ).toBeVisible({ timeout: 10000 });
  });
});
