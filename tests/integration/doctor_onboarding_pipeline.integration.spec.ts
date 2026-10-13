import { expect, test } from "@playwright/test";

import { FIRST_LOGIN_TRIAL_NOTICE_TEST_ID } from "@/lib/first-login-trial-notice";
import {
  createIntegrationAdmin,
  requireSafeIntegration,
} from "./helpers/safe-integration";
import {
  createTestDoctor,
  deleteTestDoctor,
  finishEmailedSignIn,
  loginDoctorUi,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

async function signInWithPasswordForm(
  page: import("@playwright/test").Page,
  admin: import("@supabase/supabase-js").SupabaseClient,
  email: string,
  password: string,
) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login/);
  const submit = page.getByRole("button", { name: /^Sign in$/i });
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await submit.click();
  await finishEmailedSignIn(page, admin, email);
}

/**
 * Core business pipeline (PR-blocking): an approved professional's first login lands
 * on Settings → dismiss welcome → sign out → second login lands on Agenda → cleanup.
 *
 * Submitting, reviewing and approving a registration request are covered by the
 * registration_request_* specs.
 */
test.describe("Integration: doctor onboarding pipeline", { tag: "@pr-e2e" }, () => {
  test("registered professional: first login → settings, second login → agenda", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const env = requireSafeIntegration();
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Onboard Std ${nonce}`,
        specialty: "Pediatrics",
        markTrialNoticeSeen: false,
      });

      // First login (normal form — default next=/agenda, then redirect to settings).
      await signInWithPasswordForm(page, admin, fixture.email, fixture.password);
      await expect(page).toHaveURL(/\/settings(?:[/?#]|$)/, {
        timeout: 30_000,
      });
      const sidebar = page.getByTestId("settings-sidebar");
      await expect(sidebar).toContainText(`Onboard Std ${nonce}`, { timeout: 15_000 });

      const welcome = page.getByTestId(FIRST_LOGIN_TRIAL_NOTICE_TEST_ID);
      await expect(welcome).toBeVisible({ timeout: 20_000 });
      await welcome.getByRole("button", { name: /^Got it$/i }).click();
      await expect(welcome).toBeHidden({ timeout: 15_000 });

      await sidebar.getByRole("link", { name: "Profile" }).click();
      await expect(page.getByTestId("settings-specialty-locked")).toBeVisible({
        timeout: 10_000,
      });
      await sidebar.getByRole("link", { name: "Account" }).click();
      await page.getByTestId("settings-sign-out-button").click();
      await expect(page).toHaveURL(
        (url) => !url.pathname.startsWith("/agenda"),
        { timeout: 20_000 },
      );

      // Second login → dashboard (home), not settings.
      await signInWithPasswordForm(page, admin, fixture.email, fixture.password);
      await expect(page).toHaveURL(
        (url) => {
          const path = url.pathname.replace(/\/$/, "") || "/";
          return path === "/dashboard";
        },
        { timeout: 30_000 },
      );
      await expect(page.getByRole("heading", { name: /^Needs your answer$/i })).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });
});
