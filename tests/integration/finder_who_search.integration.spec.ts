import { expect, test, type Page } from "@playwright/test";

import { finderPlaceTrigger, finderSearchButton } from "./helpers/finder-specialty-combobox";
import { requireSafeIntegration } from "./helpers/safe-integration";

/**
 * Mockup R3 (user, 2026-10-16/17): no Filters panel; one "Specialty or name" field that
 * suggests specialties, then up to five professionals, then a name search. Her own photo
 * opens larger from her card. On a phone nothing goes past the screen's edge.
 */

const field = (page: Page) => page.getByTestId("finder-specialty-trigger");
const list = (page: Page) => page.locator("#finder-specialty-filter-listbox");

/** The first card's name, as the card shows it. */
async function firstCardName(page: Page): Promise<string> {
  const name = page
    .getByTestId("finder-card-hero")
    .first()
    .locator("a:not([aria-label]), p")
    .filter({ hasText: /\S/ })
    .first();
  await expect(name).toBeVisible({ timeout: 30_000 });
  return (await name.innerText()).trim();
}

/** A part of the name long enough to look up: the last word of two letters or more. */
function namePart(name: string): string {
  const words = name.split(/\s+/).filter((word) => word.length >= 2);
  return words[words.length - 1] ?? name;
}

test.describe("Finder: Specialty or name @pr-e2e @pr-e2e-finder", () => {
  test.beforeEach(() => {
    requireSafeIntegration();
  });

  test("no Filters panel; a name typed in the field searches by name, a specialty by specialty", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/paphos");
    await expect(page.getByTestId("finder-filter-panel")).toHaveCount(0);
    await expect(page.getByTestId("finder-headline")).toContainText("Cyprus’ doctors, in one search");

    const part = namePart(await firstCardName(page));
    await expect(async () => {
      await field(page).fill("");
      await field(page).pressSequentially(part, { delay: 30 });
      await expect(list(page)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    // Professionals by name come from the lookup, after a pause in typing.
    await expect(list(page).locator("[data-professional-href]").first()).toBeVisible({ timeout: 20_000 });
    const nameRow = page.getByTestId("finder-who-name-search");
    await expect(nameRow).toContainText(`Every professional named “${part}” in Paphos`);

    await nameRow.click();
    await expect(page).toHaveURL(new RegExp(`/paphos\\?(?:.*&)?name=${encodeURIComponent(part)}`), {
      timeout: 60_000,
    });
    await expect(field(page)).toHaveValue(part, { timeout: 20_000 });
    expect((await firstCardName(page)).toLowerCase()).toContain(part.toLowerCase());

    // A specialty's name runs a specialty search and drops the name.
    await field(page).fill("Dentist");
    await page.keyboard.press("Escape");
    await finderSearchButton(page).click();
    await expect(page).toHaveURL(/\/paphos\/dentist(?:\?|$)/, { timeout: 60_000 });
    await expect(page).not.toHaveURL(/name=/);
    await expect(field(page)).toHaveValue("Dentist", { timeout: 20_000 });
  });

  test("a professional picked from the suggestions opens her page", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/paphos");
    const part = namePart(await firstCardName(page));
    await expect(async () => {
      await field(page).fill("");
      await field(page).pressSequentially(part, { delay: 30 });
      await expect(list(page).locator("[data-professional-href]").first()).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 40_000 });
    const person = list(page).locator("[data-professional-href]").first();
    const href = await person.getAttribute("data-professional-href");
    expect(href).toMatch(/^\/en\/[^/]+$/);
    await person.click();
    await expect(page).toHaveURL(new RegExp(`${href}(?:[?#].*)?$`), { timeout: 60_000 });
  });

  test("her own photo opens larger; Escape closes it", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await expect(page.getByTestId("finder-card").first()).toBeVisible({ timeout: 30_000 });
    const zoom = page.getByTestId("finder-card-photo-zoom").first();
    test.skip((await zoom.count()) === 0, "No registered professional with her own photo on the first page.");
    await expect(async () => {
      await zoom.click();
      await expect(page.getByTestId("finder-card-photo-dialog")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    const dialog = page.getByTestId("finder-card-photo-dialog");
    await expect(dialog.getByRole("img")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("on a phone the search and the place list stay inside the screen", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/paphos");
    await expect(field(page)).toBeVisible({ timeout: 30_000 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    await expect(async () => {
      if ((await finderPlaceTrigger(page).getAttribute("aria-expanded")) !== "true") {
        await finderPlaceTrigger(page).click();
      }
      await expect(page.locator("#finder-place-listbox")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    const box = await page.locator("#finder-place-listbox").locator("xpath=..").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  });
});
