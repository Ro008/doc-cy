import { test, expect } from "@playwright/test";
import {
  DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE,
  DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST,
} from "@/lib/doccy-feedback";

test.describe("Support feedback modal (Formspree)", { tag: "@pr-e2e" }, () => {
  test("submitting the form shows success when Formspree accepts the POST", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Stabilized for desktop Chromium.",
    );
    test.setTimeout(60_000);

    await page.route("https://formspree.io/f/**", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/for-professionals");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Run a Smarter Practice/i,
      }),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("marketing-footer").getByRole("button", { name: /^Support$/i }).click();
    await expect(
      page.getByRole("dialog", { name: /How can we help you/i }),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("textbox", { name: /message/i }).fill("E2E support modal smoke message.");
    await page.getByRole("button", { name: /^Send message$/i }).click();

    await expect(page.getByText(/Thanks — we received your message\./i)).toBeVisible({
      timeout: 8000,
    });
  });

  test("register onboarding CTA opens feedback with locked Onboarding Request topic and prefill", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Stabilized for desktop Chromium.",
    );

    await page.goto("/register", { waitUntil: "load" });

    const demoButton = page.getByTestId("register-demo-booking");
    await expect(demoButton).toBeVisible({ timeout: 15_000 });
    await demoButton.click();

    const dialog = page.getByRole("dialog", { name: /How can we help you/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(DOCCY_FEEDBACK_SUBJECT_DEMO_REQUEST)).toBeVisible();
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await expect(dialog.getByRole("textbox", { name: /message/i })).toHaveValue(
      DOCCY_FEEDBACK_DEMO_REQUEST_PREFILL_MESSAGE,
    );
  });
});
