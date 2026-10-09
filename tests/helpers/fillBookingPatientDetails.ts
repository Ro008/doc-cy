import type { Page } from "@playwright/test";

/**
 * Gender and date of birth on the public booking form (required since 2026-10-02).
 * Skips them when the page does not have them, so the nightly production smoke keeps
 * working whichever form version is deployed.
 */
export async function fillBookingPatientDetails(page: Page): Promise<void> {
  const gender = page.getByRole("radio", { name: /Prefer not to say/i });
  if ((await gender.count()) > 0) await gender.check();
  const birth = page.locator("#patientBirthdate");
  if ((await birth.count()) > 0) await birth.fill("1990-01-01");
}
