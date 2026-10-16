import { expect, test, type Page } from "@playwright/test";

import { requireSafeIntegration } from "./helpers/safe-integration";

/**
 * The Finder's filter panel (Finder G, step 3; user, 2026-10-15/16): it opens once a
 * search is on; Book online, Today / Next 7 days, Accepts GeSY, languages and the name
 * go to the URL, the server filters and the count follows; Clear filters keeps the search.
 * Beside the results from xl, a folded Filters button above them on phones.
 */

const panel = (page: Page) => page.getByTestId("finder-filter-panel");
const filtersButton = (page: Page) => page.locator('button[aria-controls="finder-filter-body"]');

async function resultsCount(page: Page): Promise<number> {
  const text = await page.getByTestId("finder-results-count").first().innerText();
  const match = text.replace(/,/g, "").match(/(\d+)/);
  if (!match) throw new Error(`no count in "${text}"`);
  return Number(match[1]);
}

test.describe("Finder filter panel @pr-e2e @pr-e2e-finder", () => {
  test.beforeEach(() => {
    requireSafeIntegration();
  });

  test("no panel before a search; the filters narrow the list and Clear filters undoes them", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await expect(page.getByTestId("finder-header-search")).toBeVisible({ timeout: 20_000 });
    await expect(panel(page)).toHaveCount(0);

    await page.goto("/paphos");
    await expect(panel(page)).toBeVisible({ timeout: 20_000 });
    const all = await resultsCount(page);
    expect(all).toBeGreaterThan(0);

    // Desktop Large is wider than xl: the panel is open beside the results.
    await expect(filtersButton(page)).toHaveAttribute("aria-expanded", "true", { timeout: 20_000 });

    const bookOnline = panel(page).getByRole("switch");
    await expect(async () => {
      await bookOnline.click();
      await expect(page).toHaveURL(/[?&]online=1/, { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await expect(bookOnline).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
    const online = await resultsCount(page);
    expect(online).toBeLessThan(all);

    await panel(page).getByRole("radio", { name: "Next 7 days" }).click();
    await expect(page).toHaveURL(/[?&]when=week/, { timeout: 20_000 });
    await expect(panel(page).getByRole("radio", { name: "Next 7 days" })).toHaveAttribute(
      "aria-checked",
      "true",
      { timeout: 20_000 },
    );
    expect(await resultsCount(page)).toBeLessThanOrEqual(online);

    // Turning Book online off clears the time too.
    await bookOnline.click();
    await expect(page).not.toHaveURL(/online=|when=/, { timeout: 20_000 });

    await panel(page).getByLabel("Accepts GeSY").check();
    await expect(page).toHaveURL(/[?&]gesy=1/, { timeout: 20_000 });
    expect(await resultsCount(page)).toBeLessThanOrEqual(all);

    await panel(page).getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/paphos$/, { timeout: 20_000 });
    await expect.poll(() => resultsCount(page), { timeout: 20_000 }).toBe(all);
  });

  test("the name search is back in the panel", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/paphos");
    const name = panel(page).locator("#finder-name-filter");
    await expect(name).toBeVisible({ timeout: 20_000 });
    await expect(async () => {
      await name.fill("zzqx-nobody-has-this-name");
      await name.press("Enter");
      await expect(page).toHaveURL(/[?&]name=zzqx-nobody-has-this-name/, { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await expect.poll(() => resultsCount(page), { timeout: 20_000 }).toBe(0);
    await expect(filtersButton(page)).toContainText("1");
  });

  test("on a phone the panel is a folded Filters button that opens it", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/paphos");
    await expect(filtersButton(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#finder-filter-body")).toBeHidden();
    await expect(async () => {
      await filtersButton(page).click();
      await expect(page.locator("#finder-filter-body")).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await expect(filtersButton(page)).toHaveAttribute("aria-expanded", "true");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});
