import type { Page } from "@playwright/test";

/**
 * Types the reason for the visit on the public booking form. When the professional lists
 * services, the form asks for one first (user, 2026-10-09): pick Other to get the text box.
 */
export async function fillVisitReason(page: Page, reason: string): Promise<void> {
  const service = page.locator("#professionalService");
  if ((await service.count()) > 0) await service.selectOption({ label: "Other" });
  await page.locator("#visitReason").fill(reason);
}
