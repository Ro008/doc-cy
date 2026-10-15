import type { Locator, Page } from "@playwright/test";

/**
 * The public booking form's patient boxes (2026-10-10): first and last name, mobile phone with
 * a fixed dial code, birth date as Day / Month / Year. Each helper also handles the older form
 * (one "Full name" box, "Phone (priority contact)", a date input), so the nightly production
 * smoke works whichever version is deployed.
 */

export async function fillPatientName(page: Page, fullName: string): Promise<void> {
  const first = page.locator("#firstName");
  if ((await first.count()) > 0) {
    const [given, ...rest] = fullName.trim().split(/\s+/);
    await first.fill(given);
    await page.locator("#lastName").fill(rest.join(" ") || "Test");
    return;
  }
  await page.getByLabel("Full name", { exact: true }).fill(fullName);
}

export function phoneBox(page: Page): Locator {
  return page.getByRole("textbox", { name: /Mobile phone|Phone.*priority contact/i });
}

export async function fillBirthdate(page: Page, isoDate: string): Promise<void> {
  const [year, month, day] = isoDate.split("-");
  const dayBox = page.locator("#patientBirthdate-day");
  if ((await dayBox.count()) > 0) {
    await dayBox.fill(String(Number(day)));
    await page.locator("#patientBirthdate-month").fill(String(Number(month)));
    await page.locator("#patientBirthdate-year").fill(year);
    return;
  }
  const dateInput = page.locator("#patientBirthdate");
  if ((await dateInput.count()) > 0) await dateInput.fill(isoDate);
}
