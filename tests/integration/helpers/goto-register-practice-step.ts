import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { INTEGRATION_DOCTOR_PASSWORD } from "./test-doctor";

/** Native click: Playwright retries on the toggle can open then immediately close it. */
export async function selectRegisterEnglishLanguage(page: Page): Promise<void> {
  const trigger = page.getByTestId("language-multiselect-trigger");
  await trigger.evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(page.getByTestId("language-option-English")).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("language-option-English").click({ force: true });
  await expect(page.getByText(/1 language selected/i)).toBeVisible();
  await trigger.evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(page.getByTestId("language-option-English")).toBeHidden();
}

/** Fill steps 1–2 so clinic / GeSY fields on step 3 are visible. */
export async function gotoRegisterPracticeStep(page: Page): Promise<void> {
  await expect(page.getByTestId("register-wizard-continue")).toBeVisible({ timeout: 20_000 });

  await page.locator("#register-form input[name='firstName']").fill("Karina");
  await page.locator("#register-form input[name='lastName']").fill("Mino");
  await page.locator("#register-form input[name='email']").fill("karina.mino@example.com");
  await page.locator("#register-form input[name='password']").fill(INTEGRATION_DOCTOR_PASSWORD);
  await page.locator("#register-form input[name='phone']").fill("+35799123456");
  await page.getByTestId("register-wizard-continue").click();

  await expect(page.getByTestId("register-step-2")).toBeVisible();
  const avatarPath = path.join(process.cwd(), "tests", "fixtures", "e2e-person-avatar.jpg");
  await page.getByTestId("register-avatar-file-input").setInputFiles(avatarPath);
  const confirmCrop = page.getByRole("button", { name: /Confirm crop/i });
  await expect(confirmCrop).toBeVisible({ timeout: 10_000 });
  await confirmCrop.click();
  await expect(page.getByText(/Ready for submission/i)).toBeVisible({ timeout: 15_000 });

  await selectRegisterEnglishLanguage(page);
  await page.getByTestId("register-wizard-continue").click();

  await expect(page.getByTestId("register-step-3")).toBeVisible();
  await expect(page.getByTestId("register-specialty-trigger")).toBeVisible();
}
