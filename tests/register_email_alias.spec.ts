import { test, expect } from "@playwright/test";

test.describe("Register email validation", () => {
  test("accepts Gmail plus alias format", async ({ page }) => {
    await page.goto("/register");

    const emailInput = page.locator("input[name='email']");
    await emailInput.fill("rociosirvent+aliascheck@gmail.com");

    const isValid = await emailInput.evaluate(
      (el) => (el as HTMLInputElement).checkValidity()
    );
    expect(isValid).toBe(true);
  });

  test("rejects clearly invalid email format", async ({ page }) => {
    await page.goto("/register");

    const emailInput = page.locator("input[name='email']");
    await emailInput.fill("rociosirvent+bad");

    const isValid = await emailInput.evaluate(
      (el) => (el as HTMLInputElement).checkValidity()
    );
    expect(isValid).toBe(false);
  });
});

