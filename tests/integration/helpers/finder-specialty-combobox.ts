import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Opens the finder specialty combobox (labelled "Specialty"). */
export function finderSpecialtyTrigger(page: Page): Locator {
  return page.getByTestId("finder-specialty-trigger");
}

export async function openFinderSpecialtyCombobox(page: Page): Promise<void> {
  const trigger = finderSpecialtyTrigger(page);
  await expect(trigger).toBeEnabled({ timeout: 30_000 });
  const expanded = await trigger.getAttribute("aria-expanded");
  if (expanded !== "true") {
    await trigger.click();
  }
  await expect(page.locator("#finder-specialty-filter-listbox")).toBeVisible({
    timeout: 10_000,
  });
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
