import { expect, test, type Page } from "@playwright/test";

import { buildAutomatedDoctorRegistrationTestEmail } from "@/lib/e2e-doctor-registration-test";
import { createIntegrationAdmin, requireSafeIntegration } from "./helpers/safe-integration";
import { seedRealContactHolder } from "./helpers/contact-holder";
import {
  answerRegisterAccountChoices,
  selectRegisterEnglishLanguage,
  uniqueRegisterTestMobile,
  uploadRegisterAvatar,
  waitForRegisterWizardReady,
} from "./helpers/goto-register-practice-step";
import { INTEGRATION_DOCTOR_PASSWORD } from "./helpers/test-doctor";

/**
 * A professional's registration email and personal mobile belong to one real
 * professional each. The form stops on the Account step when either is taken, and
 * the submit checks again on the server (the browser check can be skipped, or the
 * number taken in the meantime). Test profiles never block anyone, so each case seeds
 * a hidden REAL professional holding the contact details.
 */

const baseUrl = () => (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").replace(/\/+$/, "");

async function fillAccountStep(page: Page, input: { email: string; mobile: string }): Promise<void> {
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("register-wizard-continue")).toBeVisible({ timeout: 20_000 });
  await waitForRegisterWizardReady(page);
  await page.locator("#register-form input[name='firstName']").fill("Contact");
  await page.locator("#register-form input[name='lastName']").fill("Unique");
  await page.locator("#register-form input[name='email']").fill(input.email);
  await page.locator("#register-form input[name='password']").fill(INTEGRATION_DOCTOR_PASSWORD);
  await page.getByTestId("register-phone-input").fill(input.mobile);
  await answerRegisterAccountChoices(page);
}

test.describe("Integration: unique registration email and mobile", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ retries: 0 });

  test("the check API reports taken contact details without naming anyone", async ({ request }) => {
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const holder = await seedRealContactHolder(admin, { mobile: uniqueRegisterTestMobile() });
    try {
      const url = `${baseUrl()}/api/register/contact-check`;
      // Formatting doesn't matter: the digits are compared.
      const spaced = `${holder.mobile!.slice(0, 4)} ${holder.mobile!.slice(4, 6)} ${holder.mobile!.slice(6)}`;
      const taken = await request.post(url, { data: { email: holder.email.toUpperCase(), mobile: spaced } });
      expect(taken.status(), await taken.text()).toBe(200);
      expect(await taken.json()).toEqual({ email: "professional", mobile: true });

      const free = await request.post(url, {
        data: { email: buildAutomatedDoctorRegistrationTestEmail(), mobile: uniqueRegisterTestMobile() },
      });
      expect(await free.json()).toEqual({ email: null, mobile: false });
    } finally {
      await holder.remove();
    }
  });

  test("the Account step stops on an email or mobile another professional uses", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const holder = await seedRealContactHolder(admin, { mobile: uniqueRegisterTestMobile() });
    try {
      await fillAccountStep(page, { email: holder.email, mobile: holder.mobile! });
      await page.getByTestId("register-wizard-continue").click();

      const emailTaken = page.getByTestId("register-email-taken");
      const mobileTaken = page.getByTestId("register-phone-taken");
      await expect(emailTaken).toContainText("already used by another professional", { timeout: 20_000 });
      await expect(mobileTaken).toContainText("already used by another professional");
      await expect(page.getByTestId("register-step-1")).toBeVisible();
      await expect(page.getByTestId("register-step-2")).toBeHidden();

      // Editing a field clears its message; the other one still blocks.
      await page.locator("#register-form input[name='email']").fill(buildAutomatedDoctorRegistrationTestEmail());
      await expect(emailTaken).toBeHidden();
      await page.getByTestId("register-wizard-continue").click();
      await expect(mobileTaken).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("register-step-2")).toBeHidden();

      await page.getByTestId("register-phone-input").fill(uniqueRegisterTestMobile());
      await expect(mobileTaken).toBeHidden();
      await page.getByTestId("register-wizard-continue").click();
      await expect(page.getByTestId("register-step-2")).toBeVisible({ timeout: 20_000 });
    } finally {
      await holder.remove();
    }
  });

  test("submitting refuses a mobile taken after the Account step, and creates no login", async ({ page }) => {
    test.setTimeout(180_000);
    const admin = createIntegrationAdmin(requireSafeIntegration());
    const email = buildAutomatedDoctorRegistrationTestEmail();
    const mobile = uniqueRegisterTestMobile();
    let holder: Awaited<ReturnType<typeof seedRealContactHolder>> | null = null;
    try {
      await fillAccountStep(page, { email, mobile });
      await page.getByTestId("register-wizard-continue").click();
      await expect(page.getByTestId("register-step-2")).toBeVisible({ timeout: 20_000 });

      // Someone else becomes a professional with this mobile meanwhile.
      holder = await seedRealContactHolder(admin, { mobile });

      await uploadRegisterAvatar(page);
      await selectRegisterEnglishLanguage(page);
      await page.getByTestId("register-wizard-continue").click();
      await expect(page.getByTestId("register-step-3")).toBeVisible();
      await page.getByTestId("register-specialty-trigger").click();
      await page.getByRole("button", { name: "Cardiology", exact: true }).click();
      await page.getByTestId("register-license-0").fill("UNIQ-LIC-1");
      const clinicSearch = page.getByTestId("register-clinic-search-0");
      await clinicSearch.fill("lefkotheou");
      const option = page.getByTestId("register-clinic-search-0-option").first();
      await expect(option).toBeVisible({ timeout: 15_000 });
      await option.click();
      await page.locator("#register-form input[name='professionalDisclaimer']").check();
      await page.getByRole("button", { name: /Submit My Application/i }).click();

      await expect(page).toHaveURL(/\/register\?.*error=mobile_in_use/, { timeout: 90_000 });
      await expect(page.getByText(/mobile number is already used by another professional/i)).toBeVisible();

      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const logins: Array<{ id: string; email?: string }> = users?.users ?? [];
      const login = logins.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (login) await admin.auth.admin.deleteUser(login.id);
      expect(login, "no login is created for a refused application").toBeUndefined();
    } finally {
      await holder?.remove();
    }
  });
});
