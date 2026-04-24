import { test, expect } from "@playwright/test";

test.describe("Prod smoke: settings and public profile link", () => {
  test("doctor opens settings and can reach public profile", async ({ page }) => {
    test.setTimeout(120_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const email = (process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "").trim();
    const password = (process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "").trim();

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production."
    );
    test.skip(!email || !password, "Missing test credentials.");

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Sign in/i }).click();

    try {
      await page.waitForURL(/\/agenda(?:[/?#]|$)/, { timeout: 30_000 });
    } catch {
      await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    }
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 45_000 });

    await page.goto("/agenda/settings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda\/settings(?:[/?#]|$)/, { timeout: 20_000 });
    await expect(page.getByText("Settings", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Save settings/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /View public profile/i })).toBeVisible();

    const publicProfileLink = page.getByRole("link", { name: /View public profile/i });
    const href = (await publicProfileLink.getAttribute("href")) ?? "";
    expect(href.startsWith("/")).toBeTruthy();
    expect(href.startsWith("/agenda")).toBeFalsy();

    await page.goto(href, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  });
});
