// tests/landing.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("displays main headline and primary CTA", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /stop chasing appointments.*start protecting your time/i,
      }),
    ).toBeVisible();

    const primaryCta = page.getByRole("link", {
      name: /Claim your professional profile/i,
    });
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "/register");

    const professionalLogin = page.getByRole("link", {
      name: /Professional Login/i,
    });
    await expect(professionalLogin).toBeVisible();
    await expect(professionalLogin).toHaveAttribute("href", "/login");
  });

  test("primary CTA navigates to register", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", {
      name: /Claim your professional profile/i,
    });
    await expect(cta).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/register/, { timeout: 10000 }),
      cta.click(),
    ]);

    await expect(page).toHaveURL("/register");
    await expect(
      page.getByRole("heading", { name: /Create your professional profile/i }),
    ).toBeVisible({ timeout: 5000 });
  });
});
