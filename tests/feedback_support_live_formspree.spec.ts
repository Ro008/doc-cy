import { expect, test } from "@playwright/test";

/**
 * Live Formspree delivery — local manual check only (not run in PR CI).
 * Requires NEXT_PUBLIC_FORMSPREE_ID in .env.local (or PLAYWRIGHT_ENV_FILE).
 *
 * npx playwright test tests/feedback_support_live_formspree.spec.ts --project="Desktop Large (Chromium)"
 */
test.describe("Support feedback live Formspree (local only)", () => {
  test("submits Support message to Formspree and shows success", async ({ page }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Stabilized for desktop Chromium.",
    );

    const formspreeId = (process.env.NEXT_PUBLIC_FORMSPREE_ID ?? "").trim();
    const isPlaceholder =
      !formspreeId || formspreeId === "e2e_placeholder" || formspreeId === "placeholder";

    test.skip(isPlaceholder, {
      message:
        "Set NEXT_PUBLIC_FORMSPREE_ID in .env.local to your real Formspree form id, then re-run.",
    });

    const message = `[DocCy local E2E] ${new Date().toISOString()} — safe to ignore.`;

    await page.goto("/for-professionals");

    await page.getByTestId("marketing-footer").getByRole("button", { name: /^Support$/i }).click();
    const dialog = page.getByRole("dialog", { name: /How can we help you/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByRole("textbox", { name: /message/i }).fill(message);
    await dialog.getByRole("button", { name: /^Send message$/i }).click();

    await expect(page.getByText(/Thanks — we received your message\./i)).toBeVisible({
      timeout: 20_000,
    });
  });
});
