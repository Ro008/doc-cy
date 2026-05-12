import { test, expect } from "@playwright/test";

test.describe("Support feedback modal (Formspree)", () => {
  test("submitting the form shows success when Formspree accepts the POST", async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      testInfo.project.name !== "Desktop Large (Chromium)",
      "Stabilized for desktop Chromium.",
    );

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

    await page.goto("/");

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
});
