import { expect, test } from "@playwright/test";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  gotoRegisterPracticeStep,
  selectRegisterEnglishLanguage,
  uploadRegisterAvatar,
  waitForRegisterWizardReady,
  uniqueRegisterTestMobile,
} from "./helpers/goto-register-practice-step";
import { INTEGRATION_DOCTOR_PASSWORD } from "./helpers/test-doctor";
import { seedRegisterFixtures, type RegisterFixtures } from "./helpers/register-fixtures";

/**
 * "Claim this Profile" opens /register?claim=<listing id>. The account step then
 * starts from what the listing already knows; a plain /register starts blank.
 * Uses its own GeSY listing (female, one specialty): CI's synthetic seed has none.
 */
test.describe("Integration UI: register claim prefill", { tag: "@pr-e2e" }, () => {
  let fixtures: RegisterFixtures;
  test.beforeAll(async () => {
    fixtures = await seedRegisterFixtures(createIntegrationAdmin(requireSafeIntegration()));
  });
  test.afterAll(async () => {
    await fixtures?.remove();
  });

  test("a claim prefills name, gender and GeSY from the listing", async ({ page }) => {
    const listing = { ...fixtures.listing, gender: "female" as const };

    await page.goto(`/register?claim=${listing.id}`);
    await waitForRegisterWizardReady(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/We were waiting for you/i);
    const firstWord = listing.name.trim().split(/\s+/)[0]!;
    await expect(page.locator("#register-first-name")).toHaveValue(new RegExp(firstWord, "i"));
    await expect(page.locator("#register-last-name")).not.toHaveValue("");

    const gender = page.getByRole("radiogroup", { name: "Gender" });
    const expectedGender = listing.gender === "female" ? "Female" : "Male";
    await expect(gender.getByRole("radio", { name: expectedGender, exact: true })).toBeChecked();
    await expect(page.locator("[data-field-key='gender']")).toHaveAttribute("data-complete", "1");

    const gesy = page.getByRole("radiogroup", { name: /GeSY/ });
    await expect(gesy.getByRole("radio", { name: "Yes" })).toBeChecked();
    await expect(page.locator("[data-field-key='gesy']")).toHaveAttribute("data-complete", "1");

    // Only the private fields are left to type on step 1.
    await page.locator("#register-form input[name='email']").fill("claim.prefill@example.com");
    await page.locator("#register-form input[name='password']").fill(INTEGRATION_DOCTOR_PASSWORD);
    await page.getByTestId("register-phone-input").fill(uniqueRegisterTestMobile());
    await page.getByTestId("register-wizard-continue").click();
    await expect(page.getByTestId("register-step-2")).toBeVisible({ timeout: 20_000 });
    await uploadRegisterAvatar(page);
    await selectRegisterEnglishLanguage(page);
    await page.getByTestId("register-wizard-continue").click();

    // Step 3 starts from the listing's specialty.
    await expect(page.getByTestId("register-step-3")).toBeVisible();
    await expect(page.getByTestId("register-specialty-trigger")).not.toHaveText(/Select specialty/i);
  });

  test("without a claim nothing is preselected", async ({ page }) => {
    await page.goto("/register");
    await waitForRegisterWizardReady(page);
    await expect(page.locator("#register-first-name")).toHaveValue("");
    await expect(page.locator("#register-form input[name='gender']:checked")).toHaveCount(0);
    await expect(page.locator("#register-form input[name='gesy']:checked")).toHaveCount(0);

    await gotoRegisterPracticeStep(page);
    await expect(page.getByTestId("register-specialty-trigger")).toHaveText(/Select specialty/i);
  });
});
