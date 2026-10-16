import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Opens the finder specialty combobox (labelled "Specialty"). */
export function finderSpecialtyTrigger(page: Page): Locator {
  return page.getByTestId("finder-specialty-trigger");
}

export async function openFinderSpecialtyCombobox(page: Page): Promise<void> {
  const trigger = finderSpecialtyTrigger(page);
  await expect(trigger).toBeEnabled({ timeout: 30_000 });
  // A click right after a page load can land before hydration: retry until the list opens.
  await expect(async () => {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    await expect(page.locator("#finder-specialty-filter-listbox")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

export async function closeFinderSpecialtyCombobox(page: Page): Promise<void> {
  const trigger = finderSpecialtyTrigger(page);
  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    await page.keyboard.press("Escape");
  }
}

export function finderSpecialtyOption(page: Page, slug: string): Locator {
  return page.locator(`[role="option"][data-value="${slug}"]`);
}

/** Assert a specialty slug exists in the open listbox, then select it. */
export async function selectFinderSpecialty(page: Page, slug: string): Promise<void> {
  await openFinderSpecialtyCombobox(page);
  const option = finderSpecialtyOption(page, slug);
  await expect(option).toHaveCount(1, { timeout: 20_000 });
  await option.getByRole("button").click();
  await expect(finderSpecialtyTrigger(page)).toHaveAttribute("aria-expanded", "false");
}

/** Non-empty specialty slugs currently offered in the finder combobox. */
export async function listFinderSpecialtySlugs(page: Page): Promise<string[]> {
  await openFinderSpecialtyCombobox(page);
  const values = await page.locator('[role="option"][data-value]').evaluateAll((els) =>
    els
      .map((el) => el.getAttribute("data-value") ?? "")
      .filter((value) => value.length > 0),
  );
  await closeFinderSpecialtyCombobox(page);
  return values;
}

/** The header search's District or town picker (Finder G, step 2). */
export function finderPlaceTrigger(page: Page): Locator {
  return page.getByTestId("finder-place-trigger");
}

/** Picks a district ("" = All of Cyprus) in the District or town picker; does not search. */
export async function pickFinderDistrict(page: Page, district: string): Promise<void> {
  const trigger = finderPlaceTrigger(page);
  await expect(trigger).toBeEnabled({ timeout: 30_000 });
  const list = page.locator("#finder-place-listbox");
  await expect(async () => {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    await expect(list).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await list.getByRole("button", { name: district || "All of Cyprus", exact: true }).click();
  await expect(trigger).toContainText(district || "All of Cyprus");
}

export function finderSearchButton(page: Page): Locator {
  return page.getByTestId("finder-header-search").getByRole("button", { name: /^Search$/ });
}

/** "Clear search" next to the results heading. */
export function finderClearSearch(page: Page): Locator {
  return page.getByTestId("finder-clear-search").getByRole("link", { name: "Clear search" });
}

/**
 * Name search returns with the filter panel (step 3); until then a ?name= link still
 * filters the current page.
 */
export async function gotoFinderName(page: Page, name: string): Promise<void> {
  const url = new URL(page.url());
  url.searchParams.set("name", name);
  await page.goto(`${url.pathname}?${url.searchParams.toString()}`);
}
