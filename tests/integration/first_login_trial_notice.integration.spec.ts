import { expect, test } from "@playwright/test";
import { FIRST_LOGIN_TRIAL_NOTICE_TEST_ID } from "@/lib/first-login-trial-notice";
import {
  createIntegrationAdmin,
  requireSafeIntegration,
} from "./helpers/safe-integration";
import {
  createTestDoctor,
  deleteTestDoctor,
  loginDoctorUi,
  type TestDoctorFixture,
} from "./helpers/test-doctor";

test.describe("Integration UI: first-login trial notice (local only)", { tag: "@pr-e2e" }, () => {
  test("verified founder sees the notice once, then it stays dismissed", async ({ page }) => {
    test.setTimeout(120_000);
    const env = requireSafeIntegration();
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Trial Notice ${nonce}`,
        specialty: "General Practice",
        is_specialty_approved: true,
        status: "verified",
        markTrialNoticeSeen: false,
        subscription_tier: "founder",
      });

      await loginDoctorUi(page, fixture.email, fixture.password);
      await page.goto("/agenda", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/i, { timeout: 30_000 });

      const dialog = page.getByTestId(FIRST_LOGIN_TRIAL_NOTICE_TEST_ID);
      await expect(dialog).toBeVisible({ timeout: 20_000 });
      await expect(dialog.getByRole("heading", { name: /Welcome to DocCy/i })).toBeVisible();
      await expect(dialog.getByText(/first 6 months/i)).toBeVisible();
      await expect(dialog.getByText(/€19\/month/i)).toBeVisible();

      await dialog.getByRole("button", { name: /^Got it$/i }).click();
      await expect(dialog).toBeHidden({ timeout: 15_000 });

      const row = await admin
        .from("professionals")
        .select("trial_notice_seen_at")
        .eq("id", fixture.doctorId)
        .single();
      expect(row.error).toBeNull();
      expect(String(row.data?.trial_notice_seen_at ?? "").trim().length).toBeGreaterThan(0);

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/i, { timeout: 30_000 });
      await expect(page.getByTestId(FIRST_LOGIN_TRIAL_NOTICE_TEST_ID)).toHaveCount(0);
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });

  test("pending doctor on account review does not see the trial notice", async ({ page }) => {
    test.setTimeout(120_000);
    const env = requireSafeIntegration();
    const admin = createIntegrationAdmin(env);
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let fixture: TestDoctorFixture | null = null;

    try {
      fixture = await createTestDoctor({
        admin,
        nonce,
        name: `Pending Trial ${nonce}`,
        specialty: "General Practice",
        is_specialty_approved: true,
        status: "pending",
        markTrialNoticeSeen: false,
      });

      await loginDoctorUi(page, fixture.email, fixture.password);
      await page.goto("/agenda", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/agenda\/account-review/, { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: /Account under review/i })).toBeVisible();
      await expect(page.getByTestId(FIRST_LOGIN_TRIAL_NOTICE_TEST_ID)).toHaveCount(0);
    } finally {
      if (fixture) await deleteTestDoctor(fixture);
    }
  });
});
