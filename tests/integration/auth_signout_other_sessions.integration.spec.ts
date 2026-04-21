import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "../helpers/doctorAuth";

test.describe("Auth: sign out other sessions", () => {
  test("current device stays signed in and other device is revoked", async ({ browser }, testInfo) => {
    test.fixme(
      true,
      "Temporarily disabled on Supabase free tier: Auth sign-in endpoints frequently hit rate limits and make this E2E non-deterministic."
    );
    test.setTimeout(150_000);
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Run only on Desktop Chromium for CI stability."
    );

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
    const testUserEmail = (process.env.TEST_USER_EMAIL ?? "").trim();
    const testUserPassword = (process.env.TEST_USER_PASSWORD ?? "").trim();

    test.skip(!supabaseUrl || !anonKey, "Missing NEXT_PUBLIC_SUPABASE_URL / ANON key.");
    test.skip(!testUserEmail || !testUserPassword, "Missing TEST_USER_* credentials.");

    const anonClient = createClient(supabaseUrl, anonKey);

    const deviceAContext = await browser.newContext();
    const deviceBContext = await browser.newContext();
    const deviceAPage = await deviceAContext.newPage();
    const deviceBPage = await deviceBContext.newPage();

    try {
      const loginWithBackoff = async (page: typeof deviceAPage) => {
        const waitsMs = [0, 10_000, 20_000, 40_000];
        let lastErr: unknown;
        for (const waitMs of waitsMs) {
          if (waitMs > 0) {
            await page.waitForTimeout(waitMs);
          }
          try {
            await signInDoctorAndSetCookies(page, anonClient);
            return;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!/Request rate limit reached/i.test(msg)) throw err;
            lastErr = err;
          }
        }
        throw lastErr;
      };

      await loginWithBackoff(deviceAPage);
      await loginWithBackoff(deviceBPage);

      await deviceAPage.goto("/agenda/settings");
      await expect(deviceAPage).toHaveURL(/\/agenda\/settings(?:[/?#]|$)/, {
        timeout: 20_000,
      });
      await expect(
        deviceAPage.getByRole("button", { name: /Sign out on other devices/i })
      ).toBeVisible();

      await deviceBPage.goto("/agenda");
      await expect(deviceBPage).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });

      await deviceAPage.getByRole("button", { name: /Sign out on other devices/i }).click();
      await expect(
        deviceAPage.getByText(/Other devices have been signed out\./i)
      ).toBeVisible({ timeout: 15_000 });

      // Current device must remain authenticated.
      await deviceAPage.goto("/agenda");
      await expect(deviceAPage).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });

      // Session revocation on the other device may take some time to propagate.
      await expect
        .poll(
          async () => {
            await deviceBPage.goto("/agenda", { waitUntil: "domcontentloaded" });
            return new URL(deviceBPage.url()).pathname;
          },
          { timeout: 90_000, intervals: [1500, 3000, 5000] }
        )
        .toBe("/login");
    } finally {
      await deviceAContext.close().catch(() => undefined);
      await deviceBContext.close().catch(() => undefined);
    }
  });
});

