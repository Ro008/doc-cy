import { expect, test } from "@playwright/test";

test.describe("Password reset UI", { tag: "@pr-e2e" }, () => {
  test("login offers forgot-password and reset page explains a missing link", async ({
    page,
  }) => {
    await page.goto("/login");
    const forgot = page.getByRole("link", { name: /Forgot your password\?/i });
    await expect(forgot).toBeVisible();

    await page.getByLabel("Email").fill("reset-ui@example.com");
    await forgot.click();
    await expect(page).toHaveURL(/\/forgot-password/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Reset your password/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("reset-ui@example.com");
    await expect(page.getByRole("button", { name: /Send reset link/i })).toBeVisible();

    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: /Choose a new password/i })).toBeVisible();
    await expect(
      page.getByText(/invalid or has expired/i),
    ).toBeVisible({ timeout: 15_000 });
  });
});
