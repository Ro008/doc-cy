import { expect, test } from "@playwright/test";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import {
  gotoRegisterPracticeStep,
  selectRegisterEnglishLanguage,
  uploadRegisterAvatar,
  waitForRegisterWizardReady,
} from "./helpers/goto-register-practice-step";
import { INTEGRATION_DOCTOR_PASSWORD } from "./helpers/test-doctor";

/**
 * "Claim this Profile" opens /register?claim=<listing id>. The account step then
 * starts from what the listing already knows; a plain /register starts blank.
 * Read-only: it only loads an existing unregistered listing, nothing is written.
 */
test.describe("Integration UI: register claim prefill", { tag: "@pr-e2e" }, () => {
  test("a claim prefills name, gender and GeSY from the listing", async ({ page }) => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const { data, error } = await admin
      .from("professionals")
      .select("id, name, gender")
      .eq("is_registered", false)
      .eq("is_archived", false)
      .eq("is_gesy", true)
      .in("gender", ["female", "male"])
      .not("name", "ilike", "%dr.%")
      .limit(1)
      .single();
    expect(error, error?.message).toBeNull();
    const listing = data as { id: string; name: string; gender: "female" | "male" };

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
    await page.getByTestId("register-phone-input").fill("+35799123456");
    await page.getByTestId("register-wizard-continue").click();
    await expect(page.getByTestId("register-step-2")).toBeVisible();
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
