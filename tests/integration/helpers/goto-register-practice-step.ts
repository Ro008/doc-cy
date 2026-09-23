import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { INTEGRATION_DOCTOR_PASSWORD } from "./test-doctor";

/** 600×600: above the 400×400 minimum the avatar upload enforces. */
export const REGISTER_AVATAR_FIXTURE = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "e2e-person-avatar-600.jpg",
);

/** 128×128: below the minimum, for the "too small" case. */
export const REGISTER_SMALL_AVATAR_FIXTURE = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "e2e-person-avatar.jpg",
);

/** Languages are one-click pills on /register (no dropdown). */
export async function selectRegisterEnglishLanguage(page: Page): Promise<void> {
  const pill = page.getByTestId("language-option-English");
  await pill.click();
  await expect(pill.getByRole("checkbox")).toBeChecked();
}

/** Upload the fixture photo and confirm the crop. */
export async function uploadRegisterAvatar(page: Page): Promise<void> {
  await page.getByTestId("register-avatar-file-input").setInputFiles(REGISTER_AVATAR_FIXTURE);
  const confirmCrop = page.getByRole("button", { name: /Confirm crop/i });
  await expect(confirmCrop).toBeVisible({ timeout: 10_000 });
  await confirmCrop.click();
  await expect(page.getByTestId("register-avatar-ready")).toBeVisible({ timeout: 15_000 });
}

/**
 * The form is server-rendered, so its controls are visible before React hydrates.
 * Typing earlier is lost or never validated; wait for the wizard to mark the form.
 */
export async function waitForRegisterWizardReady(page: Page): Promise<void> {
  await expect(page.locator("#register-form[data-wizard-step]")).toBeAttached({ timeout: 30_000 });
}

/** Step 1 radio questions (gender, GeSY). Clicks the visible pill, not the hidden radio. */
export async function answerRegisterAccountChoices(
  page: Page,
  answers: { gender?: "Male" | "Female"; gesy?: "Yes" | "No" } = {},
): Promise<void> {
  await page
    .getByRole("radiogroup", { name: "Gender" })
    .getByText(answers.gender ?? "Female", { exact: true })
    .click();
  await page
    .getByRole("radiogroup", { name: /GeSY/ })
    .getByText(answers.gesy ?? "Yes", { exact: true })
    .click();
}

/** Fill step 1 so the profile step (photo, languages) is open. */
export async function gotoRegisterProfileStep(page: Page): Promise<void> {
  await expect(page.getByTestId("register-wizard-continue")).toBeVisible({ timeout: 20_000 });
  await waitForRegisterWizardReady(page);

  await page.locator("#register-form input[name='firstName']").fill("Karina");
  await page.locator("#register-form input[name='lastName']").fill("Mino");
  await page.locator("#register-form input[name='email']").fill("karina.mino@example.com");
  await page.locator("#register-form input[name='password']").fill(INTEGRATION_DOCTOR_PASSWORD);
  await page.getByTestId("register-phone-input").fill("+35799123456");
  await answerRegisterAccountChoices(page);
  await page.getByTestId("register-wizard-continue").click();

  await expect(page.getByTestId("register-step-2")).toBeVisible();
}

/** Fill steps 1–2 so clinic / GeSY fields on step 3 are visible. */
export async function gotoRegisterPracticeStep(page: Page): Promise<void> {
  await gotoRegisterProfileStep(page);
  await uploadRegisterAvatar(page);
  await selectRegisterEnglishLanguage(page);
  await page.getByTestId("register-wizard-continue").click();

  await expect(page.getByTestId("register-step-3")).toBeVisible();
  await expect(page.getByTestId("register-specialty-trigger")).toBeVisible();
}
